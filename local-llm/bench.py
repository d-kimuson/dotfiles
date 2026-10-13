#!/usr/bin/env python3
"""llama-server のスループット計測。

llama.cpp の応答に含まれる timings を読むだけ。投機デコードが効いていれば
draft_n / draft_n_accepted も出るので、MTP の有無で比較できる。

HTTP は curl に任せる。portless のローカル CA は OS のトラストストアに入っており、
curl はそれを見るが、OpenSSL を同梱した Python は CA の拡張子不足で弾くため。

  python3 bench.py                     # 既定のプロンプトで計測
  python3 bench.py --runs 3
  python3 bench.py --model <model-id>
  BASE=https://llama.localhost python3 bench.py
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess

BASE = os.environ.get("BASE", "https://llama.localhost")

PROMPTS = {
    "short": "Write an iterative Python function that returns the first n Fibonacci numbers.",
    "long": (
        "Explain how speculative decoding works in an LLM inference server: "
        "what the draft model does, how acceptance works, and why it is lossless. "
        "Cover the interaction with KV cache and batching."
    ),
}


def curl(path: str, payload: dict | None = None, timeout: int = 900) -> dict:
    cmd = ["curl", "-sS", "--max-time", str(timeout), f"{BASE}{path}"]
    if payload is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(payload)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def pick_model(explicit: str | None) -> str:
    if explicit:
        return explicit
    models = curl("/v1/models")["data"]
    if not models:
        raise SystemExit("サーバにモデルがない。/v1/models が空")
    return models[0]["id"]


def run(model: str, prompt: str, max_tokens: int) -> dict:
    res = curl(
        "/v1/chat/completions",
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0,
            "stream": False,
        },
    )
    timings = res.get("timings", {})
    usage = res.get("usage", {})
    return {
        "prompt_tok_s": timings.get("prompt_per_second"),
        "decode_tok_s": timings.get("predicted_per_second"),
        "prompt_n": timings.get("prompt_n"),
        "predicted_n": timings.get("predicted_n"),
        "draft_n": timings.get("draft_n"),
        "draft_accepted": timings.get("draft_n_accepted"),
        "completion_tokens": usage.get("completion_tokens"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--max-tokens", type=int, default=256)
    args = ap.parse_args()

    model = pick_model(args.model)
    print(f"base : {BASE}")
    print(f"model: {model}\n")

    for name, prompt in PROMPTS.items():
        runs = [run(model, prompt, args.max_tokens) for _ in range(args.runs)]
        decode = [r["decode_tok_s"] for r in runs if r["decode_tok_s"]]
        prefill = [r["prompt_tok_s"] for r in runs if r["prompt_tok_s"]]
        last = runs[-1]

        print(f"[{name}] prompt={last['prompt_n']} tok, generated={last['predicted_n']} tok")
        if prefill:
            print(f"  prefill : {statistics.median(prefill):8.1f} tok/s")
        if decode:
            print(f"  decode  : {statistics.median(decode):8.1f} tok/s")
        if last["draft_n"]:
            acc = (last["draft_accepted"] or 0) / last["draft_n"] * 100
            print(f"  draft   : {last['draft_accepted']}/{last['draft_n']} accepted ({acc:.1f}%)")
        else:
            print("  draft   : なし(投機デコード無効)")
        print()


if __name__ == "__main__":
    main()

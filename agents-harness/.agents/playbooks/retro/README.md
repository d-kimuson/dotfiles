# retro

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) の Retro Loop。`/retro` prompt はこれへの alias。

- 手動で実行する。学習だけでなく、ハーネスへの期待値 Gap も探す
- 出力は 2 つ。期待値 Gap は User Scope Harness へのフィードバック、スキル不足は本人が選んだものだけ Learning Backlog (Personal Task Board の列) へ
- ログの抽出はスクリプト化した。本人の発言以外 (差し込まれた文脈、compaction の要約、Orca からの委譲文) を除き、セッション内の重複を 1 件にまとめる。前回の実行時刻は `~/.agents/state/retro/last-run` に持つ

本文: [PLAYBOOK.md](./PLAYBOOK.md)

# パイプラインの実装仕様

`pipeline/buildVideo.ts` が次の順に呼ぶ。定数は `FPS = 30`, `SAMPLE_RATE = 24000`。

1. VOICEVOX ENGINE を使える状態にし (`withVoicevox`)、立ち絵を取得 → 全セリフを合成
2. タイムライン (`gapSeconds: 0.25`, `sceneGapSeconds: 0.6`) → cue ごとの弾みトラック → 撮影計画
3. 撮影計画の静止画を Playwright で撮る (`out/<slug>/frames/<shotKey>.png`。毎回 frames を消してから撮る)
4. 音声トラック (`audio.wav`) と ffconcat リスト (`frames.ffconcat`) を書く
5. ffmpeg で `video.mp4` → `transcript.json` と `index.html` を書く

各段の頭で `1/5 VOICEVOX で読み上げ音声を合成しています` のように進捗を stderr に出し、撮影は 50 枚ごとに `  done/total` を出す。戻り値は `{ videoPath, pagePath, transcript, bytes }` (bytes は MP4 のサイズ)。

## キャスト

`cast/cast.ts`。話者ごとの声・立ち絵スタイル・クレジットを 1 か所に持つ。`creditLine()` は動画のトップバーとプレイヤーページの両方で使う。

```ts
export type VoiceParams = {
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
};

export type CastMember = {
  /** 字幕・プレイヤーページに出す名前 */
  label: string;
  /** VOICEVOX の /speakers に出てくる話者名とスタイル名 */
  voicevox: { speakerName: string; styleName: string };
  /**
   * 表情ごとに立ち絵を差し替えるスタイル名 (声は voicevox.styleName のまま)。
   * VOICEVOX がスタイル別の立ち絵を配布しているキャラだけ指定する
   */
  faceStyles: Partial<Record<Face, string>>;
  voice: VoiceParams;
  /** 利用規約で求められるクレジット表記 */
  credit: string;
};

/** ながら見向けに少し速め。前後の無音はタイムライン側で間を足すので短くする */
const BASE_VOICE: VoiceParams = {
  speedScale: 1.15,
  pitchScale: 0,
  intonationScale: 1.1,
  volumeScale: 1,
  prePhonemeLength: 0.05,
  postPhonemeLength: 0.05,
};

/** ずんだもん = 聞き手、四国めたん = 解説役 */
export const CAST: Record<Speaker, CastMember> = {
  zundamon: {
    label: 'ずんだもん',
    voicevox: { speakerName: 'ずんだもん', styleName: 'ノーマル' },
    faceStyles: { happy: 'あまあま', smug: 'ツンツン', troubled: 'なみだめ' },
    voice: BASE_VOICE,
    credit: 'VOICEVOX:ずんだもん',
  },
  metan: {
    label: '四国めたん',
    voicevox: { speakerName: '四国めたん', styleName: 'ノーマル' },
    faceStyles: {},
    voice: BASE_VOICE,
    credit: 'VOICEVOX:四国めたん',
  },
};

export const creditLine = (cast: Record<Speaker, CastMember> = CAST): string =>
  Object.values(cast)
    .map((member) => member.credit)
    .join(' / ');

/** 話者ごとの値を作る (Record<Speaker, T> を型を崩さずに組み立てる) */
export const bySpeaker = <T>(f: (speaker: Speaker) => T): Record<Speaker, T> => ({
  zundamon: f('zundamon'),
  metan: f('metan'),
});
```

- **クレジット `VOICEVOX:ずんだもん / VOICEVOX:四国めたん` は利用規約で必須**。動画とプレイヤーページから消さない。
- ずんだもんは VOICEVOX がスタイル別の立ち絵を配布しているので、表情に応じて立ち絵だけ差し替える (声はノーマルのまま)。めたんは 1 枚。

## VOICEVOX ENGINE

### API (`voicevox/api.ts`)

使うのは 5 本だけ。応答は zod の `looseObject` で使うフィールドだけ検証し、残りは素通しする。fetch には `AbortSignal.timeout` を付ける (probe 3 秒 / 通常 30 秒 / synthesis 120 秒)。

| 用途                 | リクエスト                                                        | 使うフィールド                                    |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| 起動確認・キャッシュキー | `GET /version`                                                 | 文字列                                            |
| 話者一覧             | `GET /speakers`                                                   | `[{ name, speaker_uuid, styles: [{ name, id }] }]` |
| 立ち絵・規約         | `GET /speaker_info?speaker_uuid=<uuid>&resource_format=base64`    | `policy` (md), `portrait` (base64 PNG), `style_infos: [{ id, portrait?, icon }]` |
| 合成パラメータ       | `POST /audio_query?text=<text>&speaker=<styleId>`                 | AudioQuery 全体                                   |
| 合成                 | `POST /synthesis?speaker=<styleId>` (body: AudioQuery JSON)       | WAV バイト列                                      |

話者名 + スタイル名 → `styleId` / `speaker_uuid` は `/speakers` から引く (`resolveStyleId`)。見つからなければ使える `話者/スタイル` の一覧を添えてエラーにする。

```ts
export const DEFAULT_VOICEVOX_URL = 'http://127.0.0.1:50021';

export const Speakers = z.array(
  z.looseObject({
    name: z.string(),
    speaker_uuid: z.string(),
    styles: z.array(z.looseObject({ name: z.string(), id: z.number().int() })),
  }),
);
export type Speakers = z.infer<typeof Speakers>;

export const SpeakerInfo = z.looseObject({
  policy: z.string(),
  /** base64 の PNG */
  portrait: z.string(),
  style_infos: z.array(
    z.looseObject({ id: z.number().int(), portrait: z.string().nullish(), icon: z.string() }),
  ),
});
export type SpeakerInfo = z.infer<typeof SpeakerInfo>;

/** 合成パラメータ。読み上げ調整で上書きするフィールドだけ型を付ける */
export const AudioQuery = z.looseObject({
  speedScale: z.number(),
  pitchScale: z.number(),
  intonationScale: z.number(),
  volumeScale: z.number(),
  prePhonemeLength: z.number(),
  postPhonemeLength: z.number(),
  outputSamplingRate: z.number().int(),
  outputStereo: z.boolean(),
});
export type AudioQuery = z.infer<typeof AudioQuery>;

export type StyleRef = { speakerName: string; styleName: string };
export type ResolvedStyle = { styleId: number; speakerUuid: string };

export const resolveStyleId = (speakers: Speakers, ref: StyleRef): ResolvedStyle => {
  const speaker = speakers.find((s) => s.name === ref.speakerName);
  const style = speaker?.styles.find((s) => s.name === ref.styleName);
  if (!speaker || !style) {
    const available = speakers.flatMap((s) => s.styles.map((st) => `${s.name}/${st.name}`));
    throw new Error(
      `VOICEVOX に ${ref.speakerName}/${ref.styleName} がありません。使えるもの: ${available.join(', ')}`,
    );
  }
  return { styleId: style.id, speakerUuid: speaker.speaker_uuid };
};

export type VoicevoxClient = {
  version: () => Promise<string>;
  speakers: () => Promise<Speakers>;
  speakerInfo: (speakerUuid: string) => Promise<SpeakerInfo>;
  audioQuery: (text: string, styleId: number) => Promise<AudioQuery>;
  /** WAV のバイト列を返す */
  synthesis: (query: AudioQuery, styleId: number) => Promise<Uint8Array>;
};

/** 応答がないまま固まったときに CLI ごと止まらないようにする */
const TIMEOUT_MS = { probe: 3000, default: 30_000, synthesis: 120_000 } as const;

export const createVoicevoxClient = (baseUrl: string = DEFAULT_VOICEVOX_URL): VoicevoxClient => {
  const request = async (
    path: string,
    params: Record<string, string>,
    timeoutMs: number,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch(
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          throw new Error(`VOICEVOX ${path} が ${timeoutMs / 1000} 秒以内に応答しませんでした`, {
            cause: error,
          });
        }
        throw error;
      },
    );
    if (!res.ok) {
      throw new Error(`VOICEVOX ${path} が ${res.status} を返しました: ${await res.text()}`);
    }
    return res;
  };
  const json = async <T>(schema: z.ZodType<T>, res: Promise<Response>): Promise<T> =>
    schema.parse(await (await res).json());

  return {
    version: async () => json(z.string(), request('/version', {}, TIMEOUT_MS.probe)),
    speakers: async () => json(Speakers, request('/speakers', {}, TIMEOUT_MS.default)),
    speakerInfo: async (speakerUuid) =>
      json(
        SpeakerInfo,
        request(
          '/speaker_info',
          { speaker_uuid: speakerUuid, resource_format: 'base64' },
          TIMEOUT_MS.default,
        ),
      ),
    audioQuery: async (text, styleId) =>
      json(
        AudioQuery,
        request('/audio_query', { text, speaker: String(styleId) }, TIMEOUT_MS.default, {
          method: 'POST',
        }),
      ),
    synthesis: async (query, styleId) => {
      const res = await request('/synthesis', { speaker: String(styleId) }, TIMEOUT_MS.synthesis, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
      });
      return new Uint8Array(await res.arrayBuffer());
    },
  };
};
```

### 起動・停止 (`voicevox/engine.ts`)

`withVoicevox(baseUrl, log, fn)`:

- `/version` が返ればそのエンジンを使う (起動も停止もしない)。
- 返らなければ `voicevox-engine --host <host> --port <port>` を spawn し、1 秒おきに `/version` をポーリング (最大 180 秒。初回はモデル読み込みで遅い)。
- 起動待ちと `fn` の実行は、子プロセスの `error` / `exit` と `Promise.race` する (エンジンが落ちたら stderr の末尾 4000 字を添えて即失敗)。
- `finally` で SIGTERM → 5 秒で止まらなければ SIGKILL。

```ts
/** 初回はモデルの読み込みで時間がかかる */
const STARTUP_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1000;
/** SIGTERM で止まらなければ SIGKILL する */
const SHUTDOWN_GRACE_MS = 5000;

const stop = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), SHUTDOWN_GRACE_MS);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
};

const isUp = async (client: VoicevoxClient): Promise<boolean> =>
  client.version().then(
    () => true,
    () => false,
  );

/**
 * VOICEVOX ENGINE を使って fn を実行する。
 * すでに起動していればそれを使い、なければ `voicevox-engine` (nix devShell が PATH に置く) を起動して、終わったら止める。
 */
export const withVoicevox = async <T>(
  baseUrl: string,
  log: (message: string) => void,
  fn: (client: VoicevoxClient) => Promise<T>,
): Promise<T> => {
  const client = createVoicevoxClient(baseUrl);
  if (await isUp(client)) return fn(client);

  const { hostname, port } = new URL(baseUrl);
  log(`  VOICEVOX ENGINE を起動しています (${baseUrl})`);
  const child = spawn('voicevox-engine', ['--host', hostname, '--port', port], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  const exited = new Promise<never>((_, reject) => {
    child.once('error', (error) => {
      reject(
        new Error('voicevox-engine を起動できません。`nix develop` の中で実行してください', {
          cause: error,
        }),
      );
    });
    child.once('exit', (code) => {
      reject(new Error(`voicevox-engine が終了しました (code ${code}):\n${stderr}`));
    });
  });

  try {
    const started = performance.now();
    const waitUntilUp = async (): Promise<void> => {
      while (!(await isUp(client))) {
        if (performance.now() - started > STARTUP_TIMEOUT_MS) {
          throw new Error(
            `VOICEVOX ENGINE が ${STARTUP_TIMEOUT_MS / 1000} 秒以内に起動しませんでした`,
          );
        }
        await sleep(POLL_INTERVAL_MS);
      }
    };
    await Promise.race([waitUntilUp(), exited]);
    return await Promise.race([fn(client), exited]);
  } finally {
    child.removeAllListeners('exit');
    exited.catch(() => {});
    await stop(child);
  }
};
```

### 立ち絵 (`cast/portraits.ts`)

- 話者ごとに `/speaker_info` を取り、`style_infos` からスタイルの `portrait` を選ぶ。既定スタイルに portrait がなければ `info.portrait`。
- PNG を `.cache/voicevox/portrait-<speaker>[-<face>].png`、規約を `policy-<speaker>.md` に保存し、パスの一覧を `portraits.json` に書く。
- `portraits.json` のキーはキャストの (話者, voicevox, faceStyles) の sha256。キーが一致しファイルが揃っていればエンジンなしで返す (preview がエンジン不要で動く)。

```ts
/** 立ち絵ファイルのパス。faces にない表情は base を使う */
export const CharacterPortraits = z.strictObject({
  base: z.string(),
  faces: z.partialRecord(z.enum(FACES), z.string()),
});
export type CharacterPortraits = z.infer<typeof CharacterPortraits>;

export const Portraits = z.record(Speaker, CharacterPortraits);
export type Portraits = z.infer<typeof Portraits>;

/** CAST の指定どおりに、既定と表情別の立ち絵 (base64 PNG) を選ぶ */
export const pickPortraits = (
  member: CastMember,
  speakers: Speakers,
  info: SpeakerInfo,
): CharacterPortraits => {
  const portraitOf = (styleName: string): string | undefined => {
    const { styleId } = resolveStyleId(speakers, {
      speakerName: member.voicevox.speakerName,
      styleName,
    });
    return info.style_infos.find((s) => s.id === styleId)?.portrait ?? undefined;
  };
  const faces: Partial<Record<Face, string>> = {};
  for (const face of FACES) {
    const styleName = member.faceStyles[face];
    const portrait = styleName === undefined ? undefined : portraitOf(styleName);
    if (portrait !== undefined) faces[face] = portrait;
  }
  return { base: portraitOf(member.voicevox.styleName) ?? info.portrait, faces };
};

/** .cache/voicevox/portraits.json */
const Manifest = z.strictObject({ key: z.string(), portraits: Portraits });
```

## 音声合成 (`tts/voicevox.ts`)

1 セリフずつ (`yomi ?? text`) 合成する。

1. `audio_query` → 返った AudioQuery にキャストの `voice` を上書きし、`outputSamplingRate: 24000`, `outputStereo: false` にする。
2. `synthesis` の WAV を `.cache/tts/<key>.wav` に atomic write。
3. `key` = sha256(`{ text, styleId, voice, sampleRate, engineVersion, v: CACHE_VERSION }`) の先頭 24 桁。あれば合成しない。

並列度は 1 (エンジンは 1 リクエストで CPU を使い切るので並列にしても速くならない)。

## WAV (`audio/wav.ts`)

mono / 16bit PCM だけを扱う最小実装。

- `decodeWav`: `RIFF`/`WAVE` を確かめ、チャンクを走査して `fmt ` (format=1, channels=1, bits=16 以外はエラー) と `data` を読む。チャンクは奇数長なら 1 バイト詰め物がある。
- `encodeWav`: 44 バイトのヘッダ + little-endian の Int16。
- `concatPadded(segments)`: 各セリフの音声を `length` サンプルまで無音で埋めて連結する。`length = cue.totalFrames × (24000 / 30)` にすることで、映像と音声のずれが原理的に起きない。

## タイムライン (`timeline/timeline.ts`)

セリフ 1 つ = cue 1 つ。発話のフレーム数を切り上げ、セリフ間 (0.25 秒) とシーン間 (0.6 秒、最終シーンは除く) の無音を足す。`sampleRate / fps` が整数でなければエラーにする。

```ts
export type Cue = {
  index: number;
  sceneIndex: number;
  lineIndex: number;
  startFrame: number;
  speechFrames: number;
  totalFrames: number;
  /** 段階表示の表示件数。段階表示できないスライドでは null */
  reveal: number | null;
};

export type Chapter = { sceneIndex: number; title: string; startFrame: number };

export type Timeline = {
  fps: number;
  cues: Cue[];
  chapters: Chapter[];
  totalFrames: number;
};

/**
 * 各セリフ時点での段階表示件数を求める。
 * シーン内で reveal が一度も指定されなければ全件表示、指定があれば最初は 0 件から始めて直前の値を引き継ぐ。
 */
export const resolveReveals = (scene: Scene): (number | null)[] => {
  const max = revealableCount(scene.slide);
  if (max === null) return scene.lines.map(() => null);
  const usesReveal = scene.lines.some((line) => line.reveal !== undefined);
  let current = usesReveal ? 0 : max;
  return scene.lines.map((line) => {
    current = line.reveal ?? current;
    return current;
  });
};

const secondsToFrames = (seconds: number, fps: number): number => Math.round(seconds * fps);

/**
 * @param speechSamples scenes[i].lines[j] の音声サンプル数
 */
export const buildTimeline = (
  episode: Episode,
  speechSamples: readonly (readonly number[])[],
  config: TimelineConfig,
): Timeline => {
  if (!Number.isInteger(config.sampleRate / config.fps)) {
    // 音声をフレーム境界で区切るため、1 フレームのサンプル数は整数でなければならない
    throw new Error(
      `sampleRate (${config.sampleRate}) は fps (${config.fps}) で割り切れる必要があります`,
    );
  }
  const gapFrames = secondsToFrames(config.gapSeconds, config.fps);
  const sceneGapFrames = secondsToFrames(config.sceneGapSeconds, config.fps);
  const cues: Cue[] = [];
  const chapters: Chapter[] = [];
  let cursor = 0;

  episode.scenes.forEach((scene, sceneIndex) => {
    chapters.push({ sceneIndex, title: scene.chapter, startFrame: cursor });
    const reveals = resolveReveals(scene);
    const isLastScene = sceneIndex === episode.scenes.length - 1;

    scene.lines.forEach((_, lineIndex) => {
      const samples = speechSamples[sceneIndex]?.[lineIndex];
      if (samples === undefined) {
        throw new Error(`音声がありません: scenes[${sceneIndex}].lines[${lineIndex}]`);
      }
      const speechFrames = Math.ceil((samples * config.fps) / config.sampleRate);
      const isSceneEnd = lineIndex === scene.lines.length - 1;
      const totalFrames =
        speechFrames + gapFrames + (isSceneEnd && !isLastScene ? sceneGapFrames : 0);
      cues.push({
        index: cues.length,
        sceneIndex,
        lineIndex,
        startFrame: cursor,
        speechFrames,
        totalFrames,
        reveal: reveals[lineIndex] ?? null,
      });
      cursor += totalFrames;
    });
  });

  return { fps: config.fps, cues, chapters, totalFrames: cursor };
};
```

## 立ち絵の弾み (`timeline/animation.ts`)

話者の立ち絵を声に合わせて上下させる。フレームごとの RMS を取り、そのセリフ内の最大 RMS の 12% を超えたフレームを発声中とみなす。発声中は 4 フレーム上 / 4 フレーム下を繰り返し、無音で元に戻る (位相もリセット)。

```ts
export type BounceConfig = {
  fps: number;
  sampleRate: number;
  /** 最大 RMS に対するこの比率を超えたフレームを発声中とみなす */
  voicedRatio: number;
  /** 発声中に「弾む/戻る」を繰り返すフレーム数 (立ち絵を声に合わせて上下させる) */
  upFrames: number;
  downFrames: number;
};

export const DEFAULT_BOUNCE: Omit<BounceConfig, 'fps' | 'sampleRate'> = {
  voicedRatio: 0.12,
  upFrames: 4,
  downFrames: 4,
};

const frameRms = (samples: Int16Array, from: number, to: number): number => {
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / (to - from));
};

/**
 * 音声の音量から立ち絵の弾みトラックを作る。
 * 発声中は upFrames/downFrames の周期で上下し、無音区間では元の位置に戻る。
 */
export const bounceTrack = (
  samples: Int16Array,
  totalFrames: number,
  config: BounceConfig,
): boolean[] => {
  const samplesPerFrame = config.sampleRate / config.fps;
  const rms = Array.from({ length: totalFrames }, (_, f) =>
    frameRms(
      samples,
      Math.round(f * samplesPerFrame),
      Math.min(samples.length, Math.round((f + 1) * samplesPerFrame)),
    ),
  );
  const threshold = Math.max(...rms, 0) * config.voicedRatio;
  const cycle = config.upFrames + config.downFrames;
  let voicedRun = 0;
  return rms.map((value) => {
    if (threshold === 0 || value <= threshold) {
      voicedRun = 0;
      return false;
    }
    const up = voicedRun % cycle < config.upFrames;
    voicedRun++;
    return up;
  });
};
```

## 撮影計画 (`timeline/framePlan.ts`)

全フレームを撮らない。1 枚の見た目は (cue, pose) で決まるので、その組ごとに 1 回だけ撮り、「同じ絵が何フレーム続くか」の run 列を ffmpeg の concat demuxer に渡す。5 分の動画でも撮影は数百枚で済む。

```ts
export type Pose = {
  bounce: boolean;
};

/** 撮影する静止画 1 枚 = (セリフ, ポーズ) の組 */
export type Shot = { key: string; cueIndex: number; pose: Pose };

/** 同じ静止画が連続するフレーム数 */
export type Run = { shotKey: string; frames: number };

export type FramePlan = { shots: Shot[]; runs: Run[] };

const flag = (b: boolean): string => (b ? '1' : '0');

export const shotKey = (cueIndex: number, pose: Pose): string =>
  `c${String(cueIndex).padStart(4, '0')}-b${flag(pose.bounce)}`;

/**
 * フレームごとのポーズを計算し、撮影が必要な静止画とその並びを求める。
 * @param bounceTracks cue ごとの弾みトラック (長さは cue.totalFrames 以上)
 */
export const planFrames = (
  timeline: Timeline,
  bounceTracks: readonly (readonly boolean[])[],
): FramePlan => {
  const shots = new Map<string, Shot>();
  const runs: Run[] = [];

  for (const cue of timeline.cues) {
    const track = bounceTracks[cue.index] ?? [];
    for (let f = 0; f < cue.totalFrames; f++) {
      const pose: Pose = { bounce: track[f] ?? false };
      const key = shotKey(cue.index, pose);
      if (!shots.has(key)) shots.set(key, { key, cueIndex: cue.index, pose });
      const last = runs.at(-1);
      if (last?.shotKey === key) {
        last.frames++;
      } else {
        runs.push({ shotKey: key, frames: 1 });
      }
    }
  }

  return { shots: [...shots.values()], runs };
};

/**
 * ffmpeg concat demuxer 用のリストを作る。
 * concat demuxer は最後の duration を無視するため、最後のファイルを重ねて書く。
 */
export const toFfconcat = (
  runs: readonly Run[],
  fps: number,
  pathOf: (shotKey: string) => string,
): string => {
  const lines = ['ffconcat version 1.0'];
  for (const run of runs) {
    lines.push(
      `file '${pathOf(run.shotKey).replaceAll("'", "'\\''")}'`,
      `duration ${(run.frames / fps).toFixed(6)}`,
    );
  }
  const last = runs.at(-1);
  if (last) lines.push(`file '${pathOf(last.shotKey).replaceAll("'", "'\\''")}'`);
  return `${lines.join('\n')}\n`;
};
```

## 1 枚の描画状態 (`render/frameState.ts`)

`frameStateFor(episode, cue, pose)` が、1 枚を描くのに必要な情報をすべて作る。

```ts
type CharacterPose = { face: Face; bounce: boolean; speaking: boolean };
type FrameState = {
  episodeTitle: string;
  chapter: string;               // scene.chapter
  slide: Slide;
  reveal: number | null;         // cue.reveal
  subtitle: { speaker: Speaker; text: string };
  characters: Record<Speaker, CharacterPose>;
};
// 話者: face = line.face ?? 'normal', bounce = pose.bounce, speaking = true
// 聞き手: face = line.partnerFace ?? 'normal', bounce = false, speaking = false
```

これを [stage.md](stage.md) の `renderStage` で HTML にして撮る。

## エンコード (`encode/ffmpeg.ts`)

静止画リスト (concat demuxer) + 音声 WAV → MP4。静止画主体なので `-tune stillimage` と CRF 28 で 5 分 10 MB 前後になる。読み上げごとの音量差は loudnorm で -16 LUFS に揃える。

```ts
export type EncodeRequest = {
  concatListPath: string;
  audioPath: string;
  outPath: string;
  fps: number;
  /** x264 の品質 (大きいほど小さく粗い)。静止画主体なので 28 前後で十分 */
  crf: number;
};

/** 静止画リスト (concat demuxer) と音声トラックから MP4 を作る ffmpeg 引数 */
export const encodeArgs = ({
  concatListPath,
  audioPath,
  outPath,
  fps,
  crf,
}: EncodeRequest): string[] => [
  '-y',
  '-v',
  'error',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatListPath,
  '-i',
  audioPath,
  '-map',
  '0:v',
  '-map',
  '1:a',
  '-fps_mode',
  'cfr',
  '-r',
  String(fps),
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-tune',
  'stillimage',
  '-crf',
  String(crf),
  '-pix_fmt',
  'yuv420p',
  // 読み上げごとの音量差を均すため、配信系の目安 (-16 LUFS) に揃える
  '-af',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-ar',
  '48000',
  '-c:a',
  'aac',
  '-b:a',
  '96k',
  '-movflags',
  '+faststart',
  '-shortest',
  outPath,
];
```

外部コマンドは `execFile` で 10 分のタイムアウトを付けて実行し、失敗時は stderr をエラーメッセージに含める。

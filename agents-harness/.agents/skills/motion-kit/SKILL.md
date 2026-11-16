---
name: motion-kit
description: Write, render and check programmatic videos with motion-kit (`@kimuson/motion-kit`), a framework where scenes are React/TSX on a deterministic timeline and a CLI renders them to MP4 or PNG. Use when creating or editing a motion-kit Composition, rendering or previewing a video, capturing frames, or reading a motion-kit Diagnostic.
---

# motion-kit

motion-kit is an agent-first framework for programmatic video. A video is a Composition: a React
component plus its size, frame rate and duration, exported from an entry file in a `compositions`
registry. Every frame is a pure function of time; the CLI captures frames in Chromium (Playwright) and
encodes them with FFmpeg, and reports every failure as a Diagnostic with a stable `code`, as JSON with
`--json`.

## Running the CLI

```bash
npx @kimuson/motion-kit <command> [args]        # works with or without an install
npx @kimuson/motion-kit --help                  # every command; <command> --help for its options
```

In a project that depends on the package, the bin is `motion-kit` (`pnpm exec motion-kit`,
`npx motion-kit`, `yarn motion-kit`). Do not run a bare `npx motion-kit` without an install: it
fetches an unrelated package.

## Setting up a project

A Composition imports `@kimuson/motion-kit`, so a project needs the package and its peers installed,
plus the Chromium build that motion-kit's Playwright version captures frames in:

```bash
pnpm add @kimuson/motion-kit react react-dom zod      # or npm install / yarn add
pnpm why playwright                                   # the Playwright version motion-kit uses; npm ls playwright with npm
pnpm dlx playwright@<version> install chromium        # once per machine; npx playwright@<version> with npm
```

Playwright is a dependency of motion-kit, not of the project, so pnpm does not put a `playwright` bin
in the project; run the version it reports rather than the latest.

An `.mp4` target also needs FFmpeg 6.0+ with `libx264` on `PATH`, which motion-kit does not install
(`ffmpeg -version`); a Composition that declares audio also needs its companion `ffprobe`. `frame`,
`contact-sheet` and `preview` work without FFmpeg. `docs getting-started` has the full requirements
and `docs troubleshooting` the per-OS FFmpeg installs.

## Read the docs before writing code

The guides ship with the package, and `docs` prints them. Read the topic you need instead of guessing
the API, the flags or the meaning of a Diagnostic code.

```bash
npx @kimuson/motion-kit docs                    # the index: overview, quickstart, guide map
npx @kimuson/motion-kit docs --list             # the topic ids, one per line with a summary
npx @kimuson/motion-kit docs <topic>            # one guide by its id from --list
npx @kimuson/motion-kit docs <topic> --json     # the same markdown in data.content
```

Start with `docs getting-started` for a new project, `docs authoring` for the Composition API,
`docs cli` for commands and the `--json` envelope, and `docs troubleshooting` for a Diagnostic
code. With the package installed, the same files are under `node_modules/@kimuson/motion-kit/docs/`.

---
name: dev-process-kit
description: Build shared understanding with the user through single-file HTML pages that they review and comment on in the browser. Use when the user should check or agree on your understanding — requirements, a design, a domain, a plan, open questions — instead of a long text reply.
---

# dev-process-kit

Show what you understood as one HTML file. The user operates and comments on it in the browser and hands the review back as a brief; you rewrite the file. Repeat until you agree.

## Principles

Humans have little context and do not read long text well.

- **Visualize.** Put the structure in a map or diagram; prose only for what a picture cannot say.
- **Narrow.** Include only what the user needs to agree or disagree. Omit the obvious and the off-topic.
- **Dig through dialogue.** Surface decisions and uncertain points instead of pre-answering them, and go deeper where the user's comments point.

## Steps

1. Get the latest version: the `version` of <https://registry.npmjs.org/dev-process-kit/latest>. Use that exact version everywhere below.
2. Read the docs of that version at its Git tag: `https://raw.githubusercontent.com/d-kimuson/dev-process-kit/v<version>/docs/index.md`.
3. Pick one template (and any components) from the docs' "Choose a template" and read only their pages: `…/v<version>/docs/views/<name>.md` and `…/v<version>/docs/components/<name>.md`.
4. Decide how the page reaches the user. When your session has the Artifact tool, publish the page as a Claude Artifact and give the user the link — the kit is built for that viewer: its navigation, drafts and review all work there, and the review can come back to you without pasting. Read `…/v<version>/docs/claude-artifact.md` before writing, since an Artifact is written differently from a local file, and publish with the capabilities it declares: without them the page has no **Send to Claude** and the user is back to pasting the brief. Give a local file only when there is no Artifact tool or the user asks for a file.
5. Write the HTML in the user's language and declare that language with `lang` on `<html>` and on the page element (`<dpk-page lang="ja">`; the kit's own UI follows it and is English without it). Load the bundle from jsDelivr with the version pinned — `https://cdn.jsdelivr.net/npm/dev-process-kit@<version>/dist/views/<name>.js` — never `@latest`: the page has to keep working after a new release. Write the page as a `<dpk-page>` with the template as its board, even when there is only one (`docs/page.md`), and give it the page's height as the docs say; the page paints itself, so style only your own content.
6. On a brief, apply it to the base data and answer the comments in the next version.

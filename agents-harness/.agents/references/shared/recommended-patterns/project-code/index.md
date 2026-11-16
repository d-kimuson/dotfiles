# Project Code Setup

Cross-language setup items applicable to any project.

## Nix Flakes + direnv

Declarative development environment. All dependencies are defined in `flake.nix` and activated automatically via direnv on `cd`.

### Setup

1. Copy `flake.nix` → customize `description` and `packages` list
   - For Node.js projects, replace `pkgs.nodejs` with `pkgs.nodejs_<major>` matching the major of `.node-version` (e.g. `.node-version` = `26.x` → `pkgs.nodejs_26`). Plain `pkgs.nodejs` is nixpkgs' default LTS line and can lag behind `.node-version`. Check availability with `nix eval nixpkgs#nodejs_<major>.name` (fast; errors if the attr does not exist).
2. Copy `.envrc` — use the content as-is
3. Run `git add flake.nix` (and `flake.lock` once generated). In a git repo, `use flake` only sees git-tracked files, so an untracked `flake.nix` makes `direnv allow` fail with "path ... does not exist".
4. Run `direnv allow` to activate
5. Add `.direnv/` to `.gitignore`

### Template Files

| File | Customize |
|------|-----------|
| `flake.nix` | `description`, `packages` list (add/remove tools per project; `pkgs.nodejs_<major>` matching `.node-version`) |
| `.envrc` | None — use as-is |

`.envrc` has a fixed shape and must not be reordered:

```bash
#!/usr/bin/env bash

if has nix; then
  use flake
fi

dotenv_if_exists .env
dotenv_if_exists .env.secret
dotenv_if_exists .env.overrides

watch_file .env .env.secret .env.overrides
```

- `has nix` guards the flake activation so the repo still works on machines without Nix.
- `use flake` already watches `flake.nix` / `flake.lock`; do not add them to `watch_file`.
- `dotenv_if_exists` is evaluated in order, so later files win. Keep `.env` → `.env.secret` → `.env.overrides`.
- `watch_file` makes direnv reload when any dotenv file changes.

Project-specific watch targets (e.g. a generated env file) may be appended to the `watch_file` line, but the three dotenv files always stay.

### Adding Packages

Search nixpkgs for available packages:

```bash
nix search nixpkgs <package-name>
```

`nix search` is slow. When the attribute name is already known, check it with `nix eval nixpkgs#<attr>.name` instead.

Add to the `packages` array in `flake.nix`. Use the last segment of the attribute path (e.g. `legacyPackages.aarch64-darwin.ripgrep` → `pkgs.ripgrep`).

For unfree packages, add the package name to the `allowUnfreePredicate` list.

## LICENSE

Copy `LICENSE` if public. Update the year.

## GitHub Actions (Nix Setup)

Composite action for CI environments that use Nix devShells.

Copy `.github/actions/setup-nix/action.yml`.

The cache step is commented out by default — uncomment when ready to enable.

### Template Files

| File | Customize |
|------|-----------|
| `.github/actions/setup-nix/action.yml` | Uncomment cache step when ready |

## Environment Variables

Three dotenv files with distinct roles. Do not collapse them into one.

| File | Committed | Role |
|------|-----------|------|
| `.env` | Yes | Non-secret environment variables shared by everyone |
| `.env.secret` | No | Secrets only (tokens, API keys, credentials) |
| `.env.secret.example` | Yes | The list of keys `.env.secret` must define |
| `.env.overrides` | No | Per-developer overrides of `.env` |

Rules:

- Put a variable in `.env` unless it is a secret. A value that can be read by anyone with repo access belongs in `.env`.
- `.env.secret` holds secrets only. Never commit it, and never mirror non-secret values into it.
- `.env.secret.example` lists every key `.env.secret` is expected to define, in `KEY=` form with empty values. Update it in the same change that introduces a new secret key. If the project has no secrets yet, keep the file with comments only (drop the placeholder key and note that `KEY=` lines are added when a secret is introduced).
- `.env.overrides` is for a single developer to override `.env` locally (e.g. pointing at a local backend port). It is never committed, and nothing may *require* it to exist.

### Setup

1. Copy `.env.secret.example`, then replace the placeholder key with the project's actual keys
2. Create `.env` with the project's non-secret variables and commit it
3. Each developer copies `.env.secret.example` → `.env.secret` and fills in values

### Template Files

| File | Customize |
|------|-----------|
| `.env.secret.example` | Replace the placeholder with the project's required secret keys |

## .gitignore

Fetch language-appropriate gitignore:

```bash
# Node.js
curl "https://raw.githubusercontent.com/github/gitignore/master/Node.gitignore" | grep -v '404' >> .gitignore

# Add direnv cache
echo '.direnv/' >> .gitignore
```

### Dotenv entries

The upstream `Node.gitignore` ignores dotenv files with globs (currently `.env`, `.env.*`, and `!.env.example`; older versions used `.env.*.local`). Delete that whole dotenv block and ignore the two private files explicitly instead — `.env` and `.env.secret.example` must stay committed, and the upstream globs would silently exclude them.

```gitignore
# dotenv environment variable files
.env.secret
.env.overrides
```

Do not use globs (`.env*`, `.env.*`) for dotenv files. List `.env.secret` and `.env.overrides` and nothing else.

After editing, verify that the committed files are not ignored:

```bash
git check-ignore -v .env .env.secret.example   # expected: no output, exit 1
git check-ignore -v .env.secret .env.overrides # expected: both listed
```

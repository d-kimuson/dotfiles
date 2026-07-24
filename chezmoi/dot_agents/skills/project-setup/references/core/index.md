# Core Project Setup

Cross-language setup items applicable to any project.

## Nix Flakes + direnv

Declarative development environment. All dependencies are defined in `flake.nix` and activated automatically via direnv on `cd`.

### Setup

1. Copy `flake.nix` → customize `description` and `packages` list
2. Copy `.envrc` as-is
3. Run `direnv allow` to activate
4. Add `.direnv/` to `.gitignore`

### Template Files

| File | Customize |
|------|-----------|
| `flake.nix` | `description`, `packages` list (add/remove tools per project) |
| `.envrc` | None — use as-is |

### Adding Packages

Search nixpkgs for available packages:

```bash
nix search nixpkgs <package-name>
```

Add to the `packages` array in `flake.nix`. Use the last segment of the attribute path (e.g. `legacyPackages.aarch64-darwin.ripgrep` → `pkgs.ripgrep`).

For unfree packages, add the package name to the `allowUnfreePredicate` list.

## LICENSE

Copy `LICENSE` to project root if public. Update the year.

## GitHub Actions (Nix Setup)

Composite action for CI environments that use Nix devShells.

Copy `setup-nix-action.yml` to `.github/actions/setup-nix/action.yml`.

The cache step is commented out by default — uncomment when ready to enable.

### Template Files

| File | Customize |
|------|-----------|
| `setup-nix-action.yml` | Uncomment cache step when ready. Copy to `.github/actions/setup-nix/action.yml` |

## .gitignore

Fetch language-appropriate gitignore:

```bash
# Node.js
curl "https://raw.githubusercontent.com/github/gitignore/master/Node.gitignore" | grep -v '404' >> .gitignore

# Add direnv cache
echo '.direnv/' >> .gitignore
```

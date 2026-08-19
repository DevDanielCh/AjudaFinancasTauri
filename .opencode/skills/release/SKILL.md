---
name: release
description: >
  Step-by-step checklist for releasing a new version of AjudaFinancas.
  Updates all version files, creates git tag, pushes to GitHub.
  Use when user says "new release", "bump version", "release v0.X", "/release".
---

# Release — AjudaFinancas

## Version files (3 locations)

| File | Field | Current |
|------|-------|---------|
| `package.json` | `"version"` | `0.1.3` |
| `src-tauri/Cargo.toml` | `version` | `0.1.4` |
| `src-tauri/tauri.conf.json` | `"version"` | `0.1.4` |

All three must match. `Cargo.lock` updates automatically when `Cargo.toml` changes.

## Steps

### 1. Ask user for new version

Default: patch bump (e.g. `0.1.4` → `0.1.5`).

### 2. Update all 3 files

```
package.json         → "version": "<new>"
src-tauri/Cargo.toml → version = "<new>"
src-tauri/tauri.conf.json → "version": "<new>"
```

### 3. Verify build

```bash
cd src-tauri && cargo check
```

### 4. Commit

```bash
git add -A
git commit -m "chore: release v<new>"
```

### 5. Tag + push

```bash
git tag v<new>
git push && git push --tags
```

### 6. Create GitHub release

```bash
gh release create v<new> --title "v<new>" --generate-notes
```

Workflows `release.yml` (desktop) and `mobile-android.yml` trigger automatically on `v*` tags.

### 7. Smoke test

- Desktop: download exe/AppImage from release, verify sync + settings
- Android: download APK, install on device, verify safe areas + sync

## Notes

- If tag already exists locally: `git tag -d v<old>` + `git push origin :refs/tags/v<old>`
- If tag already exists on remote, delete via `gh api` before re-pushing
- CI reads `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from GitHub Secrets (no `.env` in CI)

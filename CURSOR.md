# Cursor project rules

Same contract as `CLAUDE.md`. Agents in this repo read both.

## Commits

Every commit message is **English**. One declarative line. Do not write Korean commit messages.

```
v0.97: Fade the settings language list with a top and bottom blur.
```

Ask the user before raising `VER`, committing, pushing, deleting a branch, or `wrangler deploy`.

## README languages

One file: `README.md`. Write English, Chinese, Japanese, and Hindi as consecutive sections in that file. Do not split into `README.zh.md` / `README.ja.md` / `README.hi.md`. When the docs change, update all four sections.

## Version

`app.js` `const VER` increments by 1 on each change (`0.96 → 0.97`). The first decimal digit is the GitHub Pages patch: `VER=0.70` → `v0.3.7`. Never lower `?v=`. Pages source is `static-0.3.X`, not `main`.

Cursor also loads `.cursor/rules/commits-and-docs.mdc` on every session.

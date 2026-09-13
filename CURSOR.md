# Cursor project rules

Same contract as `CLAUDE.md`. Agents in this repo read both.

## Commits

Every commit message is **English**. One declarative line. Do not write Korean commit messages.

```
v0.4.145: Expand a province cell into its districts on double-click.
```

Ask the user before raising `VER`, committing, pushing, deleting a branch, or `wrangler deploy`.

## README language

One file: `README.md`, written in English only. Do not add to or edit the Chinese, Japanese, or Hindi sections, and do not split into per-language files.

## Version

A release is `vA.B.C`. A (large change) and B (small change) are chosen by hand from what changed. C is `VER` from `app.js` without the dot: `VER = '1.45'` → `v0.4.145`. Raising A resets B to zero. `VER` goes up by `0.01` on every change. Never lower `?v=`. Each release gets a new branch `static-A.B.C`; the Pages source is that branch, not `main`.

Cursor also loads `.cursor/rules/commits-and-docs.mdc` on every session.

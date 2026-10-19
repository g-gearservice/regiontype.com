# CRT Terminal beta — design

Design canvas for a CRT terminal style beta. Source of the Claude design canvas
https://claude.ai/artifact/4Z8reRE91BuXhT4YNWV1Pb (private until shared from its Share menu).

| File | Artboard |
|---|---|
| `canvas.json` | Canvas layout (artboard frames and order) |
| `Main.dc.html` | Design language: day/night tokens, type, cell states, log lines, prompt, tube effects |
| `Game.dc.html` | Interactive play screen, night (Gangseo-gu only) |
| `GameDay.dc.html` | The same screen with the day theme |

These are canvas sources, not site pages: they load the canvas runtime (`./support.js`),
which is not in this repository, so they do not open on their own.
Neighborhood names and one-line intros come from `data/bus.json` as they are.

Turning this into a page under `beta/` is separate work and follows the VER and
`data/changes.json` rules in `CLAUDE.md`.

`.gitignore` ignores every `design/` folder, so these files were force-added;
a new file here needs `git add -f` too.

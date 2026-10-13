# Dashain 2083 (2026) decorations

The festival greeting pop-up (with falling ribbons) and the 3D kite on the home page.
Everything lives in this folder; nothing else in the site depends on it.

| File | What |
|---|---|
| `config.ts` | Dates, wording, which pages show what, colours. **Edit the offer text here.** |
| `index.tsx` | `DashainFestival`, the only thing `App.tsx` mounts. Loads the rest lazily, only during the festival. |
| `DashainPopup.tsx` | The greeting card (toran, tika, jamara, "Bijayadashami Offers"). |
| `Ribbons.tsx` | The falling ribbons and marigold petals (canvas). |
| `DashainKite.tsx` | The 3D changa kite (three.js) that climbs as you scroll. |

**Switches itself off** after `ends` in `config.ts` (26 Oct 2026, after Kojagrat Purnima), even if the
code is still deployed. Preview any time with `?dashain=on` in the address (`?dashain=off` hides it).

## Taking it down

1. Delete this folder: `src/app/festive/dashain/`.
2. In `src/app/App.tsx`, delete the two lines marked `Dashain`:
   the `import { DashainFestival } …` line and the `<DashainFestival … />` line.
3. Remove three.js (only this folder uses it): `npm uninstall three @types/three`.
4. `npm run typecheck && npm run build`.

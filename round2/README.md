# CYBER QUEST · THE BLACKOUT PROTOCOL — Round 02: THREAT MATRIX

Static web app (HTML + CSS + vanilla JS + SVG). No backend, no build step.

## Run on macOS
1. Unzip the project and open Terminal in the folder:
   `cd ~/Downloads/cyber-quest-threat-matrix`
2. Start a static server: `python3 -m http.server 9000`
3. Open http://localhost:9000 (Chrome or Safari). Press **Ամբողջ էկրան** for fullscreen.

## Picture
`assets/trojan-horse.png` is the hidden Trojan Horse image (shown unmodified, scaled to fill the 5:3 board; other ratios are centre-cropped). To swap it, replace the file keeping the name and hard-refresh (Cmd+Shift+R).

## Structure
- `index.html` – page skeleton, SVG board, question modal, reset dialog
- `style.css` – visual design (palette, modal, timer ring, piece states)
- `app.js` – questions, jigsaw geometry, timer, animations, LocalStorage
- `assets/trojan-horse.png` – the hidden picture (bottom layer)
- `assets/fonts/` – bundled fallback font (Armenian glyph support)

## How it works
- **Geometry:** 5×3 grid of lightly jittered vertices; each interior edge is one Bezier tab/socket curve
  shared by both neighbours (one forwards, one reversed), so pieces tile with no gaps/overlaps.
- **Two layers:** the picture sits below and is visible *only* through an SVG mask that is empty at the start
  (fully hidden); a piece's shape is added to the mask when it is removed. Pieces are opaque.
- **Progress** is saved in LocalStorage (key `cyberquest.threatmatrix.v1`) and restored on refresh.

## Teacher notes
- Click a piece → question; **▶ Սկսել 20 վրկ** starts the timer (never automatic).
- **✓ ՃԻՇՏ Է** → piece falls. **✕ Սխալ է** → piece locks permanently.
- Timer reaching 0 plays a sound and shows ԺԱՄԱՆԱԿԸ ՍՊԱՌՎԵՑ; you still choose correct/incorrect.
- Keyboard: **Esc** closes a question without recording a result; **A** shows/hides the answer on screen
  (hidden by default — don't press it while projecting).

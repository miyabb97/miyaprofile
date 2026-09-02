# miyaprofile

Personal portfolio site for **Miya Lee Jia Man** — business & systems analyst.

Static, no build step, no dependencies to install. Open `index.html` and it works.

## Structure

```
index.html                  markup + all copy
assets/css/styles.css       design tokens, layout, responsive rules
assets/js/scene.js          the hero 3D scene (Three.js)
assets/js/main.js           reveal-on-scroll, sticky nav, card tilt
assets/Miya-Lee-Resume.pdf  the résumé the CTAs link to
```

Three.js is loaded from cdnjs via a plain `<script>` tag, so there is no
bundler and no `node_modules`.

## Running it locally

Double-clicking `index.html` works. To serve it over HTTP instead:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploying to GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → `main` / `root`.
The site is served as-is; there is nothing to build.

## Updating content

| What | Where |
| --- | --- |
| Any text, job, project, certification | `index.html` — it's plain HTML, edit in place |
| The résumé PDF | replace `assets/Miya-Lee-Resume.pdf` (keep the filename, or update the two links in `index.html`) |
| Colours, spacing, type scale | the `:root` block at the top of `assets/css/styles.css` |
| The 3D shapes, colours, orbits | `PALETTE` and `buildSystem()` in `assets/js/scene.js` |

The stats strip in the hero is hand-written in `index.html` (search for
`class="stats"`) — update those numbers when the résumé changes.

## Notes on how it behaves

- **`prefers-reduced-motion`** is respected: the 3D renders one static frame,
  reveals and the marquee don't animate, card tilt is off.
- **The 3D only renders while it's on screen** and pauses on tab blur.
- **If WebGL or the CDN fails**, the canvas is replaced by a static gradient
  mark — the page never shows a blank hole.
- **If JavaScript fails entirely**, all content is still visible: the
  reveal-on-scroll styles are gated behind a `has-js` class, with a
  belt-and-braces sweep in `<head>`.
- Card tilt is limited to fine pointers, so it never interferes with touch.

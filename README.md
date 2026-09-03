# Generative Ink

A generative canvas art toy in the browser. Move your mouse or finger across the canvas to paint flowing, glowing particle trails — with optional sound reactivity via your microphone.

## Running it

No build step or dependencies required.

**Option 1 — open directly**

Open `index.html` in a browser.

**Option 2 — local server (recommended for microphone access)**

```powershell
./serve.ps1
```

Then visit `http://localhost:8734/`.

## Controls

- **Mood** — switch between `Calm`, `Chaotic`, and `Symmetrical` painting styles.
- **Brush size** — controls the size of spawned particles.
- **Trail fade** — controls how quickly painted trails fade out.
- **Enable mic** — reacts to microphone input: volume drives particle bursts, bass/treble shift the color palette.
- **Clear canvas** — wipes the canvas.
- Toggle button (top right) — shows/hides the control panel.

## Browser support

Requires a modern browser with Canvas 2D and (for mic reactivity) the Web Audio API and `getUserMedia`.

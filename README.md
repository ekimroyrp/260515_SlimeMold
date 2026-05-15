# 260515_SlimeMold

260515_SlimeMold is a WebGPU slime mold simulation built with Three.js, TypeScript, and Vite. It uses additive particles driven by a live Physarum-style sensor/turn/deposit trail field on a 2D ground plane, seeded food points, editable food sources, and the same compact control-panel style as the StrangeAttractor reference project.

## Features

- WebGPU-only Three.js particle display.
- Live 2D ground-plane trail field with agent sensing, turning, depositing, diffusion, and decay.
- Particles are the live slime agents that create the yellow trail pattern on the floor.
- Left-click food placement and double-click food deletion.
- Food radius and strength controls with seeded reset.
- Material gradient controls, map display toggle, and PNG screenshot export.
- Undo and redo for simulation controls and food edits with `Ctrl+Z` and `Ctrl+Y`.
- Browser and canvas right-click menus are blocked so RMB navigation stays available.

## Getting Started

1. Install dependencies with `npm.cmd install`.
2. Start the local Vite server with `npm.cmd run dev`.
3. Open the printed localhost URL in a current Chromium-based browser with WebGPU enabled.
4. Build the production bundle with `npm.cmd run build`.

## Controls

- `Wheel`: Zoom.
- `MMB`: Pan.
- `RMB`: Orbit.
- `Left click`: Add a food dot on the ground plane.
- `Double left click`: Delete an existing food dot.
- `Ctrl+Z`: Undo the previous food or control edit.
- `Ctrl+Y`: Redo the next food or control edit.
- `Start` / `Pause`: Toggle particle motion.
- `Reset`: Stop and reset the particle display.
- `Reset Food`: Restore the seeded food layout.

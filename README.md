# 260515_SlimeMold

260515_SlimeMold is a WebGPU slime mold simulation built with Three.js, TypeScript, and Vite. It uses additive particles driven by a live Physarum-style sensor/turn/deposit trail field on a 2D ground plane, seeded source and food points, editable food/source placement, and the same compact control-panel style as the StrangeAttractor reference project.

## Features

- WebGPU-only Three.js particle display.
- Live 2D ground-plane trail field with agent sensing, turning, depositing, diffusion, and decay.
- Particles are the live slime agents that create the gradient trail pattern on the floor.
- Left-click food placement, `Shift+LMB` source placement, and `Ctrl+LMB` point deletion.
- Add, delete, and drag source/food points without restarting the active simulation.
- Source dots use the gradient start color, food dots use the gradient end color, and particles/map cells blend by nearest source-vs-food distance.
- Particle boundary, source radius/strength, and food radius/strength controls.
- Material gradient controls, particle/map display toggles, source/food hide toggles, and PNG screenshot export.
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
- `Click and drag source or food`: Move an existing dot on the ground plane.
- `Shift+Left click`: Add a source dot on the ground plane.
- `Ctrl+Left click`: Delete an existing source or food dot.
- `Ctrl+Z`: Undo the previous food or control edit.
- `Ctrl+Y`: Redo the next food or control edit.
- `Start` / `Pause`: Toggle particle motion.
- `Reset`: Stop and reset the particle display.
- `Particle Display` / `Map Display`: Show or hide the live particle dots and floor map independently.
- `Particle Boundary`: Resize the simulation boundary from 2 to 20 while preserving the active trail and map density.
- `Reset Sources`: Restore the seeded source layout.
- `Reset Food`: Restore the seeded food layout.
- `Hide Source` / `Hide Food`: Hide the source or food dots without removing them.

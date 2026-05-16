# 260515_SlimeMold

260515_SlimeMold is a Vite + TypeScript + Three.js slime mold playground that runs a 2D Physarum-style particle simulation on a ground plane. The app uses additive particle dots, a live trail map, editable source and food points, gradient-based source-to-food coloring, undo/redo history, screenshot export, and a compact draggable control panel based on the StrangeAttractor reference project.

## Features
- Three.js renderer with transparent additive particle dots and a floor map generated from the same live trail field.
- Physarum-style behavior loop with sensor sampling, turn steering, random drift, trail deposit, diffusion, decay, source emission, and food attraction.
- Separate Simulation and Particles sections: simulation speed/boundary controls are split from particle amount, size, display, and behavior controls.
- Behavior sliders for Turn Rate, Sensor Distance, Trail Deposit, Trail Decay, Trail Diffusion, and Random Drift, with defaults matching the original hardcoded simulation.
- Editable source and food points on the ground plane: add, delete, and drag points without restarting the active simulation.
- Source dots use the gradient start color, food dots use the gradient end color, and particles/map cells blend by nearest source-vs-food distance.
- Source and food radius/strength controls, with visible point radius scaling up to the full radius range.
- Material gradient controls, particle/map display toggles, source/food hide toggles, and numbered PNG screenshot export.
- Serializable history for controls and point edits with `Ctrl+Z` and `Ctrl+Y`.
- Browser and canvas right-click menus are blocked so RMB orbit navigation remains available.

## Getting Started
1. `npm.cmd install`
2. `npm.cmd run dev` to start Vite on the printed localhost URL
3. Open the app in the printed localhost URL
4. `npm.cmd run test` to run the unit tests
5. `npm.cmd run build` to type-check and emit a production build

## Controls
- **Navigation:** Wheel zooms, MMB pans, and RMB orbits the top-down camera.
- **Simulation:** Start/Pause toggles particle motion, Reset reinitializes the source-seeded trail, Simulation Speed adjusts the Physarum update rate, and Simulation Boundary resizes the active field from 2 to 20 while preserving trail density.
- **Particles:** Particle Amount resizes the agent count, Particle Size changes the visible dot size, Particle Display hides/shows the agents, and Map Display hides/shows the floor trail map.
- **Particle behavior:** Turn Rate changes steering response, Sensor Distance changes the forward trail sample range, Trail Deposit changes deposited trail amount, Trail Decay changes trail persistence, Trail Diffusion changes map blur/spread, and Random Drift changes wandering when no strong trail is ahead.
- **Source editing:** `Shift+LMB` adds a source, `Ctrl+LMB` deletes a source under the cursor, `LMB+Drag` moves a source, Reset Sources restores the seeded source, and Hide Source toggles source dot visibility.
- **Food editing:** `LMB` adds food, `Ctrl+LMB` deletes food under the cursor, `LMB+Drag` moves food, Reset Food restores the seeded food layout, and Hide Food toggles food dot visibility.
- **Source/Food parameters:** Source Radius and Food Radius control point influence and visible radius up to 2, while Source Strength and Food Strength control emission/attraction strength.
- **Material:** Gradient Start colors sources and source-adjacent particles/map cells, Gradient End colors food and food-adjacent particles/map cells, and Gradient Contrast/Bias/Blur tune the floor map display.
- **History and export:** `Ctrl+Z` undoes point/control edits, `Ctrl+Y` redoes them, and Export Screenshot downloads `260515_SlimeMold_###.png`.

## Deployment
- **Local production preview:** `npm.cmd install`, then `npm.cmd run build` followed by `npm.cmd run preview` to inspect the compiled bundle.
- **Publish to GitHub Pages:** From a clean `main`, run `npm.cmd run build -- --base ./`. Checkout (or create) the `gh-pages` branch in a separate worktree or temp repo, copy everything inside `dist/` plus a `.nojekyll` marker to its root, keep the flat `assets/`, `env/`, `.gitignore`, `.nojekyll`, and `index.html` structure, commit with a descriptive message, `git push origin gh-pages`, then switch back to `main`.
- **Live demo:** https://ekimroyrp.github.io/260515_SlimeMold/

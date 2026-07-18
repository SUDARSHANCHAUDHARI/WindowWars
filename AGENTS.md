# WindowWars Agent Guide

## Project

WindowWars is a dependency-free static web game built with semantic HTML, CSS, inline SVG, ES modules, and the Web Audio API.

## Commands

- `pnpm dev` — serve the source directory at `http://localhost:4173`
- `pnpm start` — serve the built `dist/` artifact at `http://localhost:4174`
- `pnpm test` — run the state and static contract tests
- `pnpm check` — run JavaScript syntax checks and all tests
- `pnpm build` — create the deployable static artifact in `dist/`
- `pnpm verify` — run the complete pre-release check and build

No dependency installation is required.

## Architecture

- `game-state.js` owns pure game transitions, attempt limits, event definitions, and the shuffled event deck.
- `script.js` owns DOM rendering, pointer/keyboard interaction, timing, generated particles, and synthesized audio.
- `index.html` owns the semantic UI and SVG scene.
- `styles.css` owns responsive layout and visual performances selected through `data-phase` and `data-effect`.
- `tests/` covers state invariants and static production contracts.

Keep state transitions out of animation callbacks wherever possible. Animation timing may dispatch actions, but the reducer decides whether each action is legal.

## Quality and safety

- Keep the game dependency-free unless a concrete requirement justifies otherwise.
- Preserve keyboard, pointer, touch, and reduced-motion behavior.
- Do not add remote fonts, analytics, trackers, prerecorded audio, or image dependencies without explicit approval.
- Do not weaken the Content Security Policy without documenting the reason.
- Do not commit `dist/`, local server files, environment files, credentials, or editor state.
- Do not add or modify GitHub Actions workflows without Sudarshan's explicit approval.
- Stage files by explicit name and use the personal Git identity for this repository.

## Release

Run `pnpm verify`, inspect the generated `dist/` contents, and follow `docs/DEPLOYMENT.md`. Repository visibility and deployment are separate decisions; never make the repository public without explicit approval.

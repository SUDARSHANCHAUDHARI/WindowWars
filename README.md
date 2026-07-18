# WindowWars

WindowWars is a self-contained interactive storm scene in which one deeply uncooperative window refuses to stay closed. Close it ten times to end the storm.

The project uses only semantic HTML, CSS, inline SVG, vanilla JavaScript, and browser-generated audio. It has no runtime dependencies, no image assets, and no prerecorded sound files.

## Features

- Illustrated room interior with an animated SVG storm
- Open, draggable window with a brass handle
- Moving curtains, layered clouds, rain, lightning, and wind trails
- Click, pointer-drag, touch, and keyboard controls
- Ten authored interruption events in a shuffled, non-repeating event deck:
  1. Wind pushes the window open
  2. A bird blocks it
  3. The handle moves away
  4. The curtains pull it open
  5. A smaller window appears
  6. Rain begins inside the room
  7. The wall opens instead
  8. A tiny character opens it
  9. The window pretends to lock
  10. Lightning scares it open
- Ten-attempt progress track and guaranteed victory state
- Procedural rain, wind, latch, event, and thunder audio using the Web Audio API
- Sound toggle that respects browser autoplay rules
- Reset control that cancels pending animations and restores the initial game state
- Responsive layouts for desktop, tablet, and mobile
- Reduced-motion support through `prefers-reduced-motion`
- Pure, tested state transitions
- Restrictive Content Security Policy and static-host security headers
- Deterministic, dependency-free production build

## Run locally

WindowWars uses JavaScript modules, so serve the directory over HTTP rather than opening `index.html` directly from the filesystem.

```bash
pnpm dev
```

Then open [http://localhost:4173](http://localhost:4173).

No install step is required because the project has no third-party packages. If `pnpm` is unavailable, the underlying command works directly:

```bash
python3 -m http.server 4173
```

## Controls

| Input | Action |
| --- | --- |
| Click or tap the window | Attempt to close it |
| Drag the window/handle to the right | Physically close it |
| `Enter` or `Space` while the window is focused | Attempt to close it |
| Sound button | Start or mute the generated storm soundtrack |
| Reset button | Return to attempt zero while preserving the sound preference |

Browsers require a user gesture before audio can begin. For that reason sound starts off; choosing **Sound off** changes it to **Sound on** and creates the audio graph.

## Game behavior

The game is driven by four explicit phases:

| Phase | Meaning | Allowed transition |
| --- | --- | --- |
| `open` | The window accepts pointer or keyboard input | `CLOSE_REQUEST` → `closing` |
| `closing` | The sash is moving shut and duplicate input is ignored | `RESOLVE_CLOSE` → `event` or `won` |
| `event` | One shuffled interruption plays and the sash reopens | `REOPEN` → `open` |
| `won` | Attempt ten is complete and the storm is calm | `RESET` → `open` |

The tenth close bypasses the interruption deck, so it always ends in `won`. The event deck shuffles all ten gags without replacement; this avoids repeats during a playthrough while keeping the order random.

## Audio design

All sound is synthesized at runtime:

- Rain is high-passed white noise.
- Wind is filtered low-frequency noise.
- Thunder combines brown noise, a falling low-pass filter, and two low sine oscillators.
- Latches, clatter, footsteps, and bird chirps use short oscillator envelopes.
- Victory fades the storm buses and plays a quiet three-note chord.

Turning sound off ramps the master gain down instead of tearing down the graph. The same gain is muted when the tab becomes hidden.

## Accessibility

- The interactive sash is keyboard focusable and exposes its changing state through an accessible label.
- Status updates use a polite live region.
- Controls are native buttons with visible focus treatment and at least 40–44 px touch targets.
- Decorative SVG groups are hidden from assistive technology; the scene has a concise title and description.
- The attempt track has a text alternative such as “4 of 10 attempts completed.”
- `prefers-reduced-motion: reduce` removes continuous animation and shortens event timing while preserving the game logic.
- Sound is optional and no gameplay information is conveyed by audio alone.

## Project structure

```text
WindowWars/
├── 404.html                  Themed static-host fallback page
├── index.html                 Semantic UI and inline SVG scene
├── styles.css                Visual system, responsive layout, and animations
├── script.js                 DOM controller, pointer input, particles, and audio
├── game-state.js             Pure reducer, event definitions, and shuffled deck
├── scripts/build.js          Deterministic production artifact builder
├── tests/
│   ├── game-state.test.js    State-machine and event-deck tests
│   └── project-contract.test.js
│                              Static feature and accessibility contracts
├── favicon.svg
├── site.webmanifest
├── robots.txt
├── _headers                   Security headers for compatible static hosts
├── docs/DEPLOYMENT.md
├── AGENTS.md
├── CHANGELOG.md
├── SECURITY.md
├── package.json
├── .gitignore
├── LICENSE
└── README.md
```

## Verification

Run syntax and automated tests:

```bash
pnpm check
```

This performs JavaScript syntax checks and the Node test suite. You can run only the state tests with:

```bash
pnpm test
```

Run the complete production verification and generate `dist/`:

```bash
pnpm verify
```

The build copies only runtime files into `dist/`; tests, repository instructions, and local metadata are excluded.

Preview the production artifact at [http://localhost:4174](http://localhost:4174):

```bash
pnpm start
```

## Production deployment

Deploy the contents of `dist/` to any static host. There are no environment variables, backend services, migrations, or runtime dependencies. Recommended host settings and the release/rollback checklist are documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The GitHub repository should remain private until its owner explicitly approves a visibility change. Repository visibility does not affect the production artifact.

## Customization

- Edit the event copy, glyphs, or timing in `EVENTS` inside `game-state.js`.
- Change the color and typography tokens at the top of `styles.css`.
- Add a visual event by creating an SVG group with the `effect` class, then target `data-effect="your-event-id"` in CSS.
- Keep event timing in the event definition rather than scattering delays through the DOM controller.

## Browser support

WindowWars targets current evergreen browsers with support for ES modules, pointer events, inline SVG, CSS custom properties, and the Web Audio API. If the Web Audio API is unavailable, the visual game remains playable.

## Security and privacy

WindowWars has no analytics, tracking, network requests, accounts, or data storage. See [SECURITY.md](SECURITY.md) for vulnerability reporting and the current security posture.

## License

[MIT](LICENSE) © 2026 SudarshanTechLabs

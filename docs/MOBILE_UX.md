# Mobile touch UI and responsive layout

Covers `src/device.js`, `src/controls.js`, `src/main.js`, `src/game.js`, `src/style.css`, `index.html` (`#rotate`), and the test `tests/browser/mobile-ui.mjs`.

## Detecting touch and device kind

- `src/device.js` sets `is-touch` or `is-keyboard`, one of `is-phone`, `is-tablet`, or `is-desktop`, and `is-portrait` or `is-landscape` on `<body>`. It dispatches a `skystunt:device` event on change.
- Touch uses the CSS `pointer` media feature, which reports the primary input. A finger is `coarse`; a mouse is `fine`. [MDN: pointer](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer)
- `any-pointer` reports whether *any* input is a given type, so a laptop with a touchscreen and a mouse is not treated as touch-first. [web.dev: Interaction](https://web.dev/learn/design/interaction) The code uses `(any-pointer: fine)` for this, and treats `maxTouchPoints` as a fallback.
- Input override: the Settings page has a Controls row. The choice (`auto`, `touch`, or `keyboard`) is stored in `localStorage` under `skystunt.input`. Storage errors (private mode) fall back to memory only.
- Phone is `short side < 600 px`. Desktop is keyboard and not phone or tablet.

## Touch targets

- Every touch control in the race HUD must be at least 44 × 44 CSS px. WCAG 2.5.5 sets the 44 × 44 CSS px target size for pointer inputs (AAA). [W3C: Understanding 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) Apple's guideline is 44 pt; Material's is 48 dp. [lighthouse-md: tap targets](https://lighthouse-md.com/audits/tap-targets)
- Test: `phone race: all controls inside the 844x390 screen and at least 40 px`. The test uses 40 px, not 44 px, so it's a weaker check than the guideline. Controls that are visually smaller are not checked against 44 px.
- Test: `phone race: controls do not overlap`.

## Controls

- Steering: a wheel that can be dragged. Drag left 90° gives `wheel` −0.72 and `st` −0.71. Release returns to 0.
- Gas: throttle. Boost: implies gas in touch mode. Brake: separate button. Keyboard Shift does not imply gas (`src/controls.js`).
- Two-finger gas plus boost gives `th=1, bo=1`. Boost alone (gas released) still sets `th=1, bo=1`.
- Camera buttons (previous and next) cycle through views. Test: 0 → 1 → 0.

## Layout

- Phone landscape: HUD in corners, controls at the bottom, minimap top right. The HUD and the minimap must not overlap the controls. Checked at 844×390.
- Phone portrait: the race is not playable, so `#rotate` (`display: flex`) asks the player to turn the phone. The rotate hint shows during the race.
- Desktop: no touch controls are rendered (count 0). The keyboard controls work as before.

## Quality default

`src/main.js` sets the default quality from the device kind. Players can still change it in Settings.

## Netcode interaction

The predictor (`src/predict.js`) and the snapshot rate (`SNAPSHOT_HZ` 30) affect how the touch input feels, because the local car is predicted from input rather than waiting for the server. The method follows Gambetta's client-side prediction and server reconciliation: each input has a sequence number, the server acknowledges the last one it applied, and the client replays unacknowledged inputs on top of the authoritative state. [Gabriel Gambetta: Client-Side Prediction and Server Reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) Remote cars are interpolated 100 ms behind real time, as Gambetta describes for other entities. [Gabriel Gambetta: Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html)

Tested in Node only (`tests/prediction.test.mjs`, 4/4). Not yet measured in a browser under real latency.

## Tests

| Test | Result (2026-10-17, localhost:8080) |
|---|---|
| `tests/browser/mobile-ui.mjs` (phone landscape, portrait, desktop) | 17/17 PASS, 0 console errors (final CSS) |
| `tests/prediction.test.mjs` | 4/4 PASS |
| `tests/sim.test.mjs` | 9/10. The Canyon lone-bot lap check still fails (known; see `docs/TEST_REPORT.md`). |

## Not verified

- A real phone or tablet. All browser runs are headless Chromium with the phone viewport emulated (844×390). Touch events are synthesized.
- Safari iOS and Android Chrome were not run.
- Screenshots: `/tmp/mobile-ui/phone-landscape.jpg`, `phone-portrait.jpg`, `desktop.jpg`. They are scratch files, not committed.

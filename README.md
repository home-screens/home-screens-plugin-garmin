# Garmin plugin for Home Screens

Shows your Garmin Connect health data on a Home Screens display: daily steps, Body Battery, sleep, and recent activities.

Requires Home Screens 1.8.0 or newer (the release that added host-managed sign-in for plugins). You sign in with your Garmin account once in the editor; the display never sees your password.

## Views

- **Daily summary** — steps progress ring with Body Battery, resting heart rate, stress, and sleep score tiles
- **Body Battery** — current level gauge, charged/drained totals, and today's trend line
- **Sleep** — total duration, sleep-stage bar (deep/light/REM/awake), and bed/wake times
- **Activities** — recent workouts with distance, duration, and average heart rate

## Shared state

The plugin publishes `plugin:garmin:body_battery`, `plugin:garmin:sleep_score`, and `plugin:garmin:steps`, so other modules can show or hide themselves based on your health data (for example, a wind-down reminder when Body Battery runs low).

## Development

```bash
npm install
npm run dev     # builds and serves the bundle at http://localhost:5173
npm test        # unit tests
npm run build   # production bundle in dist/
```

In the Home Screens editor, open Plugin Store → Developer and load `http://localhost:5173`.

## Release packaging

```bash
npm run build
mkdir -p /tmp/garmin-pkg/garmin/dist
cp manifest.json /tmp/garmin-pkg/garmin/
cp dist/bundle.js dist/bundle.js.map /tmp/garmin-pkg/garmin/dist/
tar -czf plugin.tar.gz -C /tmp/garmin-pkg garmin
shasum -a 256 plugin.tar.gz
```

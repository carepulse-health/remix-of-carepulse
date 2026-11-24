# CarePulse Android (Capacitor)

Capacitor 8 is configured: app name **CarePulse**, app ID **com.carepulse.patient**, native project in `android/`.

## Build the APK (on your own computer)
Prerequisites: Node/Bun, Android Studio (SDK + JDK 21).

```sh
git pull
bun install                # or npm install
bun run build:android      # static app build (dist/client) + cap sync android
npx cap open android       # opens Android Studio
```
In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s) (debug), or
Build > Generate Signed App Bundle / APK for a release (needs your keystore).
Run on a device/emulator with `npx cap run android`.

Repeat `bun run build:android` after every web change. The normal web build (`bun run build`) is unchanged.

## Known limits in the APK
- The clinic check-in scanner (/clinic/check-in) needs the web server; use it from the website, not the APK.
- The embedded chatbot only signs patients in when the parent origin is on its allowlist. Add `https://localhost` (the APK origin) to the chatbot's allowed origins.
- Password-reset email links open the website, not the APK.

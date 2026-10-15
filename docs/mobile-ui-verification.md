# Mobile UI verification: working simulator tools

Verified on 2026-10-14 with DeviceHub / iPhone 17 / iOS 26.5 and an Android
API 36 emulator. These are working fallbacks, not a native automation harness.

Use native screenshots for [design critique](design-screenshot-critique.md).
Use actual interactions and observable results to verify behavior. A screenshot
or a successful tap command does not prove that a control works.

## Before operating a device

- Use the user's already-running app, development server, and booted devices.
  Ask before opening a simulator window or taking control. Do not install tools,
  boot/reset devices, restart services, or run build/dev scripts automatically.
- Agree on test data before saving. Do not erase app data or household answers
  to manufacture a clean starting state.
- Select a specific device, rather than relying on whichever one is the default.
- Agent shell calls may not share variables. Repeat assignments in each call,
  or substitute the actual device ID and paths.

Discover booted iOS devices with:

```sh
xcrun simctl list devices booted
```

For Android, first check that the ADB server is already running:

```sh
lsof -n -P -iTCP:5037 -sTCP:LISTEN
```

If nothing is listening, ask the user to start their normal Android workflow.
`adb devices` can start the ADB server itself. Once it is running:

```sh
adb devices -l
```

## iOS: DeviceHub + cliclick

On the tested machine the GUI process is **DeviceHub**, not `Simulator`.
`open -a Simulator` and the guessed Xcode `Simulator.app` path failed;
`xcrun simctl` still worked. Native screenshot capture does not need the GUI
window to be foregrounded.

For mouse interaction, bring the existing window forward and read its bounds:

```sh
osascript -e 'tell application "System Events" to tell application process "DeviceHub"' \
  -e 'set frontmost to true' \
  -e 'get {name, position, size} of every window' \
  -e 'end tell'
```

This needs macOS Accessibility / Automation permission for the calling app.
Desktop screen capture may also need Screen Recording permission. If permission
was denied, ask the user to enable it in System Settings; do not change it for them.
If the process or window is absent, ask the user rather than guessing app paths.

### Coordinate calibration

`cliclick` uses **macOS desktop coordinates**, not phone screenshot pixels.

1. Use the current window bounds to capture that desktop rectangle with
   `screencapture -x -R<x>,<y>,<width>,<height> <output.png>` (replace placeholders).
   This window capture is for calibration, not the native image sent to a critic.
2. Read the capture's original pixel dimensions with `sips`. Retina captures
   can have twice the pixel dimensions of the desktop rectangle.
3. Convert a point in the original window capture to desktop coordinates:
   `desktopX = left + captureX / scale`, likewise for Y. Here `scale` is the
   capture's pixel width divided by the captured rectangle's desktop width.
4. Focus DeviceHub immediately before clicking. Recalibrate after a window move,
   resize, display change, or rotation. Account for window chrome. Capture again
   to locate controls after navigation, scrolling, or keyboard changes.

For example, `cliclick c:555,530` taps desktop coordinate (555, 530). Those values
are illustrative, not reusable coordinates for this app. `cliclick w:500` waits
500 ms; capture again after the UI settles.

Never estimate clicks from a resized image shown by an agent tool. If the original
dimensions or coordinate mapping are uncertain, ask for help rather than guessing.

### Native screenshots

Run from the repository root. Replace the device ID and use a new round directory
so existing originals are not overwritten:

```sh
IOS_DEVICE="<booted-device-udid>"
CAPTURE_DIR="docs/.screenshots/onboarding-shops/ios/round-01"
mkdir -p "$CAPTURE_DIR"
xcrun simctl io "$IOS_DEVICE" screenshot "$CAPTURE_DIR/00-shop-editor.png"
sips -g pixelWidth -g pixelHeight "$CAPTURE_DIR/00-shop-editor.png"
```

## Android: ADB

`emulator-5554` was the tested serial. Replace it with the selected running device.
These taps use **device screen coordinates**, not desktop coordinates:

```sh
adb -s emulator-5554 shell wm size
adb -s emulator-5554 shell input tap 540 1702
```

The tap coordinates are illustrative. Read the current native screenshot and its
original dimensions before choosing a point. In this session the device captured
1080×2400 pixels, while the image viewer displayed a smaller preview; copying
preview coordinates made taps miss. Check size overrides as well as physical size.

### Reloading the app

The working path was the **Expo dev menu**, not guessed debugger or HTTP endpoints:

```sh
adb -s emulator-5554 shell input keyevent 4
adb -s emulator-5554 shell input keyevent 82
```

- `4` is Back; `82` opens the Expo dev menu.
- Close any modal and dismiss the keyboard first. The menu can be ignored while
  a text field is accepting input. Confirm the screen after each Back; do not send
  repeated Back presses blindly, since they can navigate away.
- Tap the menu's **Reload** control using its current screen coordinates. This
  reloads the app, not Metro or the development stack.
- Reloading returned onboarding to Welcome; Get started resumed the stored draft.
- Verify that the expected UI change is actually present before testing. Android
  continued displaying old code while iOS had already refreshed. A new platform
  file also became active after an importing module was refreshed.

If reload remains blocked, ask the user to reload through their normal workflow.
Do not chase undocumented endpoints or restart their services.

### Native screenshots

```sh
ANDROID_DEVICE="<running-adb-serial>"
CAPTURE_DIR="docs/.screenshots/onboarding-shops/android/round-01"
mkdir -p "$CAPTURE_DIR"
adb -s "$ANDROID_DEVICE" exec-out screencap -p > "$CAPTURE_DIR/00-shop-editor.png"
sips -g pixelWidth -g pixelHeight "$CAPTURE_DIR/00-shop-editor.png"
```

## Verification and capture discipline

- After each meaningful action, inspect the new screen. Confirm the changed
  selection, validation error, saved value, or dismissed sheet—not just exit code 0.
- Check the behavior relevant to the change: selection, save, cancel, and keyboard
  open/closed. Verify each claimed platform separately; don't infer Android success
  from iOS success or vice versa.
- Keep full-screen native PNG originals. Record device/OS, image dimensions, theme,
  text size, keyboard state, and the state being captured alongside the images.
- Use stable names in `docs/.screenshots/<design-name>/`, separated by platform and
  round when needed. This directory is gitignored. Give critics explicit file paths;
  do not rely on searching ignored captures or on transient inline images.
- Report interaction results separately from visual critique. A design score—even
  9/10—says nothing about whether save, dismiss, or persistence works.

The [onboarding verification notes](profile-onboarding-verification.md) record the
shop-editor checks and remaining acceptance work. This guide does not certify the
other forms, large-text layouts, screen readers, or backend delivery.

## MCP / Maestro status

Maestro CLI/MCP and `ios-simulator-mcp` were researched but **not exercised during
this verification**. They are candidates for a separate compatibility trial, not
prerequisites or proven replacements for the commands above. Following this guide
does not authorize installing or starting them.

# 🔥 Ignis Secura — Smart Gas Safety App

React Native / Expo prototype with **native OS notifications** and **alarm sound** on gas leak detection.

---

## 📁 File Structure

```
ignis-secura/
├── App.js                   ← All components, logic & styles
├── app.json                 ← Expo config (notifications plugin, permissions)
├── babel.config.js          ← Babel preset
├── package.json             ← Dependencies
├── README.md                ← This file
│
└── assets/
    ├── logo.png             ← ★ YOUR APP LOGO (replace this)
    ├── alarm.mp3            ← ★ ALARM SOUND (replace or keep)
    ├── icon.png             ← App store icon (1024×1024 px)
    ├── adaptive-icon.png    ← Android adaptive icon foreground
    ├── splash.png           ← Splash screen image
    ├── notification-icon.png← Android notification tray icon (96×96 px, white on transparent)
    └── favicon.png          ← Web favicon
```

---

## ★ Adding Your App Logo

1. Prepare your logo as a **PNG file** (recommended: 512×512 px, transparent background).
2. Name it **`logo.png`** and place it in the **`assets/`** folder.
3. It will appear automatically in the header next to the app name.

> The logo is displayed at 44×44 px with rounded corners in the app header.

---

## ★ Adding an Alarm Sound

1. Get any `.mp3` alert/alarm sound file.
2. Name it **`alarm.mp3`** and place it in the **`assets/`** folder.
3. It will loop automatically when a leak is triggered and stop when cleared.

> **Free alarm sounds**: [freesound.org](https://freesound.org) — search "alarm" and download as MP3.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Expo Go](https://expo.dev/go) on your **physical phone** (notifications require a real device)

### Install & Run

```bash
cd ignis-secura
npm install
npx expo start
```

Scan the QR code with Expo Go. On first launch, the app will ask for **notification permission** — tap Allow.

---

## 🔔 What Happens When You Tap the Toggle

| Action | Effect |
|---|---|
| Toggle ON | OS notification fires in the phone's notification tray |
| Toggle ON | Alarm sound starts looping inside the app |
| Toggle ON | App badge count set to 1 |
| Toggle OFF | Alarm sound stops immediately |
| Toggle OFF | App badge count cleared |
| Toggle OFF | "All clear" event logged |

The OS notification appears even if you **lock the screen** or **switch to another app**.

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `expo-notifications` | Native OS push/local notifications |
| `expo-av` | Audio playback (alarm sound) |
| `expo-device` | Detect physical vs emulator device |

---

## 🏗 Building for Production

```bash
npm install -g eas-cli
eas build --platform android   # .apk / .aab
eas build --platform ios       # requires Apple developer account
```

---

## 🎨 Color Tokens

| Name | Hex | Used For |
|---|---|---|
| Primary | `#1565C0` | Header, progress bar, links |
| Safe | `#2E7D32` | Safe status text & banner |
| Danger | `#C62828` | Leak alert text & banner |
| Background | `#F0F4FC` | Screen background |
| Surface | `#FFFFFF` | Card backgrounds |

---

*Built as a smart home gas safety monitoring prototype.*

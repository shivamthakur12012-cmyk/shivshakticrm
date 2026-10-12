# 🍏 Artho Vista CRM — iOS Mobile SIM Call Sync Companion

A zero-telephony-cost native iOS companion app built with **SwiftUI & Apple CallKit (`CXCallObserver`)** for sales employees. Enables 1-tap CRM lead calling on regular cellular SIMs (Jio, Airtel, Vi, etc.) and automatically tracks and logs call durations directly to your ArthaVenture CRM timeline.

---

## ⚡ Key Features

- **Zero Telephony Cost (₹0)**: Uses the agent's regular cellular SIM calling plan.
- **Apple CallKit Integration**: Uses `CXCallObserver` to detect when cellular calls connect and disconnect in real-time.
- **1-Tap Lead Dialer**: Instant access to your assigned CRM leads with 1-tap dialer.
- **Automatic Call Duration Tracking**: Accurately calculates talk time upon call hang-up.
- **Post-Call Quick Note Capture**: Instant pop-up after every call to choose disposition tags (*"Interested"*, *"Quote Sent"*, *"Follow Up Later"*) or add notes.
- **Offline Resilient Queue**: Automatically stores call logs locally and syncs them as soon as internet connectivity is available.
- **Deep-Link Ready (`arthovista://`)**: Can be triggered directly from mobile browsers or Apple Shortcuts.

---

## 🚀 How to Build & Install on iPhone

### Option 1: Open in Xcode (Mac)
1. Copy the `ios-sim-sync` directory to a Mac.
2. Open `ArthoVistaCRMSync.xcodeproj` in **Xcode 14 / 15 / 16**.
3. Under **Signing & Capabilities**, select your free or paid Apple Developer Team (any standard Apple ID works for personal development).
4. Connect your iPhone via USB / Wi-Fi and select it as the run destination.
5. Click **Product -> Run (⌘R)** to install the app onto your iPhone.
6. *(First time only)* On your iPhone, go to **Settings -> General -> VPN & Device Management** and tap **Trust Developer**.

---

### Option 2: Build IPA using GitHub Actions (No Mac Required)
1. Push your repository to GitHub.
2. Go to the **Actions** tab in your repository and select **Build iOS App (.ipa)**.
3. Click **Run workflow**.
4. Once finished (approx. 2 minutes), download the generated **ArthoVistaCRMSync.ipa** artifact directly from the GitHub Actions run summary.

---

### Option 3: Sideload IPA onto iPhone
You can install the `.ipa` onto any iPhone using popular sideloading tools:
- **Sideloadly** (Windows & Mac): [https://sideloadly.io](https://sideloadly.io) — Drag and drop `ArthoVistaCRMSync.ipa`, enter your Apple ID, and click Start.
- **AltStore / AltServer** (Windows & Mac): [https://altstore.io](https://altstore.io) — Install wirelessly over local Wi-Fi.
- **TrollStore** (iOS 14.0–16.6.1): Permanent sideloading without 7-day re-signing.

---

## 📱 How to Use on iPhone

### Step 1: Login & Connect
1. Open **Artho CRM Sync** on your iPhone.
2. Enter your CRM Server URL (e.g. `http://10.47.22.247:5000` or `https://crm.arthovista.com`).
3. Enter your Sales Rep email & password and tap **Connect & Login**.
4. Select your active Organization.

### Step 2: Make Calls & Sync
1. On the **Leads & Call** tab, search for your lead and tap **Call**.
2. Speak with your customer on your regular cellular SIM.
3. When the call finishes and you return to the app, the **Call Completed** dialog automatically records your exact duration and lets you enter notes with 1 tap.
4. Tap **Save & Log Call to CRM** — the call instantly appears in the CRM Live Feed!

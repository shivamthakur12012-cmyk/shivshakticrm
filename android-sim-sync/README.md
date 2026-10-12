# 📱 Artho Vista CRM — Android Mobile SIM Call Sync Companion

A zero-cost native Android companion app for sales employees. Automatically logs phone calls made or received on regular SIM cards (Jio, Airtel, Vi, etc.) directly into ArthaVenture CRM without any cloud telephony per-minute fees.

---

## 🚀 How to Build & Install

### Step 1: Open in Android Studio
1. Open **Android Studio** (Electric Eel, Flamingo, Hedgehog, Iguana, or later).
2. Click **File -> Open** and select this directory (`android-sim-sync`).
3. Allow Gradle to sync dependencies automatically.

### Step 2: Build the APK
- In Android Studio, go to **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
- Once complete, click **locate** to find the output file: `app-debug.apk` (or `app-release.apk`).

### Step 3: Install on Sales Agent Phones
1. Send `app-debug.apk` to your sales team (via WhatsApp, Google Drive, or USB).
2. On the Android phone, tap the file to install (Enable *Install Unknown Apps* if prompted).

### Step 4: Login & Activate
1. Open **Artho Vista CRM Sync** on the phone.
2. Enter your CRM Server URL (e.g. `http://192.168.1.100:5000` for local or `https://crm.arthovista.com` for cloud).
3. Log in with the Employee's email & password.
4. When prompted, tap **Allow** for **Call Logs** and **Phone State** permissions.
5. Turn on **Auto-Sync**.

---

## ⚡ Features
- **Zero Telephony Cost (₹0)**: Uses the agent's regular unlimited cellular SIM calling plan.
- **Automatic Call Duration Tracking**: Automatically records exact call seconds upon call hang-up.
- **Lead Matching**: Automatically associates calls with matching leads in the CRM.
- **Dual SIM Support**: Detects and logs SIM slot 1 vs SIM slot 2.
- **Offline Resilient**: Queues calls if offline and syncs as soon as internet reconnects.

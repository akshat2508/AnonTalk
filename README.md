
---

## 🕶️ **AnonTalk — No Cap, Just Vibes ✨**

Anonymous. Simple. Real.

AnonTalk is a cross-platform mobile chat app built with **Expo (React Native)** that lets users connect anonymously in real time.
It combines a sleek onboarding flow, secure messaging using **Supabase**, and a waiting room for matching users — all while keeping conversations private and encrypted 🔒.

---

### 🧠 **Features**

✅ Anonymous real-time chat (no sign-up required)
✅ Encrypted messages using custom AES encryption logic
✅ Matchmaking “waiting room” for connecting with random users
✅ Simple onboarding flow for first-time users
✅ Modern, minimal UI built with Expo + TypeScript
✅ Works seamlessly on both Android (Soon for Ios)

---

### 🏗️ **Tech Stack**

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Frontend         | React Native (Expo) + TypeScript                 |
| Backend          | Supabase (Auth, Database, Realtime)              |
| Encryption       | Custom AES module (`src/lib/encryption.ts`)      |
| Database         | PostgreSQL (via Supabase) + local schema         |
| Build/Deployment | EAS (Expo Application Services)                  |
| Styling          | React Native StyleSheet + custom `chatStyles.ts` |

---

### 📁 **Project Structure**

```
akshat2508-anontalk/
├── App.tsx                # Entry point of the app
├── app.config.js          # Expo configuration
├── eas.json               # EAS build configuration
├── android/               # Android native files & resources
├── database/
│   └── schema.sql         # Database schema for Supabase/Postgres
├── src/
│   ├── config/
│   │   └── config.ts      # Environment / app-level configuration
│   ├── lib/
│   │   ├── encryption.ts  # Handles message encryption/decryption
│   │   ├── room.ts        # Matching logic for chat rooms
│   │   └── supabase.ts    # Supabase client setup
│   ├── navigation/
│   │   └── types.ts       # Navigation type definitions
│   └── screens/
│       ├── Onboarding.tsx # First-time user onboarding flow
│       ├── WaitingRoom.tsx# Matchmaking / pairing logic
│       ├── Chat.tsx       # Main chat UI and realtime updates
│       └── chatStyles.ts  # Centralized chat screen styles
└── backup/                # Older builds or saved backups
```

---

### ⚙️ **Setup Instructions**

#### 1️⃣ Clone the repository

```bash
git clone https://github.com/akshat2508/akshat2508-anontalk.git
cd akshat2508-anontalk
```

#### 2️⃣ Install dependencies

```bash
npm install
# or
yarn install
```

#### 3️⃣ Configure environment

Create a `.env` file or update `src/config/config.ts` with your Supabase credentials:

```ts
export const SUPABASE_URL = "https://your-instance.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-key";
```

#### 4️⃣ Run the app

```bash
npx expo start
```

Then scan the QR code with your Expo Go app 📱
or run directly on emulator:

```bash
npx expo run:android
npx expo run:ios
```

---

### 🔐 **Security Highlights**

* End-to-end encryption handled by `encryption.ts`
* No personal data stored — only anonymous user sessions
* Realtime communication powered securely by Supabase channels

---

### 📱 **Screens Overview**

| Screen          | Description                                |
| --------------- | ------------------------------------------ |
| **Onboarding**  | Intro slides or nickname setup             |
| **WaitingRoom** | Matches two users in realtime              |
| **Chat**        | Encrypted chat interface with live updates |

---

### 🚀 **Building the APK / AAB**

Use **EAS Build** (Expo Application Services):

```bash
eas build -p android --profile preview
```

Once built, your `.apk` or `.aab` will be available on your EAS dashboard.

---

### 🧩 **Possible Improvements**

* Add message timestamps and delivery indicators
* Implement group chat support
* Add “report abuse” feature
* Push notifications via Expo Notifications API

---

### 👨‍💻 **Author**

**Akshat Paul**
🔗 [GitHub](https://github.com/akshat2508) • [LinkedIn](https://linkedin.com/in/akshat-paul)

> “AnonTalk — where conversations are free from judgment, and connection is real.”

---

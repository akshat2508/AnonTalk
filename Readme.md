
# 🕵️‍♂️ AnonTalk

> An anonymous real-time chat application built with **React Native**, **Expo**, **TypeScript**, and **Supabase**.



---

## ✨ Features

- 🔐 **Anonymous Login** — No signups, no data collection.
- 💬 **Real-Time Chat Rooms** — Instantly match with someone and start chatting.
- ⏳ **Waiting Room** — Smart queueing while you wait for a match.
- 📱 **Mobile-First UI** — Built with React Native + Expo for cross-platform performance.
- 🧠 **Supabase Integration** — Real-time messaging, authentication, and backend.
- 🚀 **OTA Updates** — Push features live without asking users to reinstall the app.

---

## 🔧 Tech Stack

| Layer      | Tech                    |
|------------|-------------------------|
| Frontend   | React Native (Expo)     |
| Language   | TypeScript              |
| Backend    | Supabase (PostgreSQL)   |
| State Mgmt | useState, useEffect     |
| Deployment | EAS Build + OTA Updates |

---

## 📂 Project Structure

```

akshat2508-anontalk/
├── app.json
├── App.tsx
├── index.ts
├── tsconfig.json
├── assets/
├── database/
│   └── schema.sql
└── src/
├── config/
│   └── config.ts
├── lib/
│   ├── room.ts
│   └── supabase.ts
├── navigation/
│   └── types.ts
└── screens/
├── Chat.tsx
├── Onboarding.tsx
└── WaitingRoom.tsx

````

---

## 🛠️ Setup & Run Locally

### 1. Clone the Repo

```bash
git clone https://github.com/akshat2508/anontalk.git
cd anontalk
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Set up Supabase

* Create a [Supabase](https://supabase.io) project
* Replace values in `src/config/config.ts` with your Supabase URL & anon key

```ts
export const supabaseUrl = 'https://xyzcompany.supabase.co';
export const supabaseAnonKey = 'your-anon-key';
```

### 4. Start the App

```bash
npx expo start
```

Use Expo Go or an emulator to run the app.

---

## 📸 Screenshots

<h3 align="center">💬 Chat Interface</h3>
<p align="center">
  <img src="https://github.com/user-attachments/assets/13569586-ec77-4199-8ff5-436ff324bb30" alt="Onboarding Screen" width="200"/>
</p>

<h3 align = "center" >🖼️ Onboarding Screen</h3>

<p align="center">
  <img src="https://github.com/user-attachments/assets/dbd86ddc-1443-4ac7-8f40-a906eb93f861" alt="Waiting Room" width="200"/>
</p>

<h3 align = "center">🕓 Waiting Room</h3>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b3ba8bc0-877a-4ccd-b797-c26feab5ed2a" alt="Chat Interface" width="200"/>
</p>

<h3 align = "center">📲 Feedback Preview</h3>
<p align="center">
  <img src="https://github.com/user-attachments/assets/6040e575-e4eb-4009-9689-15354a2317f0" alt="App Preview" width="200"/>
</p>

---

## 🌍 Live Demo

> Coming Soon via Expo Public Page or Play Store or just go to the website : 
> [AnonTalk.com ](https://anon-talk-two.vercel.app/)

---

## 🧑‍💻 Author

**Akshat Paul**
[GitHub](https://github.com/akshat2508) • [LinkedIn](https://www.linkedin.com/in/akshat-paul/) • 



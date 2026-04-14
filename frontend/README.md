# ChatSphere — Frontend

A full-featured social messaging app built with **Next.js 16**, **React 19**, **TypeScript**, **Zustand**, and **Socket.IO Client**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 (with persist middleware) |
| Real-time | Socket.IO Client 4 |
| HTTP Client | Axios |
| Animations | Framer Motion 12 |
| Toasts | Sonner |

---

## Getting Started

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Environment variables
`.env.local` is already present:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 3. Run the dev server
```bash
npm run dev
```

App runs at **http://localhost:3000**

> Make sure the backend is also running on port 5000 before opening the app.

---

## Demo Walkthrough

### Step 1 — Sign Up
- Open `http://localhost:3000/auth`
- Click **Sign Up**, enter username / email / password
- You will be prompted for an OTP — **enter `123456`** (static demo code, no real email is sent)
- You are now logged in and redirected to the messages page

### Step 2 — Set Profile Type
- Go to your profile at `/profile/yourUsername`
- Click **Edit Profile**
- Toggle between **Public** and **Private**
  - **Public** → anyone can follow you instantly and see your posts
  - **Private** → follow requests need your approval; posts hidden from non-followers

### Step 3 — Find & Follow Users
- Go to `/people`
- Browse all users or use the search bar to find someone by username or email
- Click **Follow**
  - Public profile → followed instantly
  - Private profile → sends a follow request (button shows **Requested**)
- Approve incoming follow requests from your profile page (yellow badge)

### Step 4 — Start a Chat
- Click **Message** on any user's profile, or use **New Chat** on `/messages`
- Type a message and press **Enter** or click the send button
- Attach an image using the paperclip icon (up to 10 MB)

### Step 5 — Real-time Features (best tested with two browser tabs)
- **Typing indicator** — animated dots appear when the other person is typing
- **Delivery ticks** — single gray tick → double gray tick → double blue tick
- **Online indicator** — green dot on avatar + "Online" in the chat header
- **Last seen** — shows "Last seen X ago" when the other user is offline

### Step 6 — Posts & Media
- Go to your profile → click **Add Post** → upload an image + optional caption
- Your feed at `/posts` shows posts from you + people you follow + all public accounts
- Like, comment, and delete posts
- Private profile posts are locked behind a gate for non-followers

### Forgot Password Flow
- On the login screen click **Forgot Password**
- Enter your registered email → enter OTP **`123456`** → set new password

---

## Implemented Features

### Authentication
- Email + password signup with validation (min 6-char password, unique email/username)
- JWT stored in Zustand and persisted to `localStorage` — stays logged in after refresh
- Email verification via OTP on signup (`123456` for demo)
- Full forgot-password flow: email → OTP → reset token → new password
- Auto-redirect to `/auth` when token is missing or expired

### User Search & Discovery
- `/people` page lists all users with infinite scroll (IntersectionObserver)
- Live search by username or email (debounced API calls)
- Each user card shows: avatar, username, bio, online indicator, follow/unfollow button
- Follow button renders correct state: **Follow** / **Requested** / **Following**

### Real-time Messaging
- Messages sent via **Socket.IO** with automatic **REST fallback** if socket drops
- Undelivered messages queued and delivered the moment the recipient reconnects
- Image attachments in messages (paperclip button, up to 10 MB)
- 2000-character limit with a live countdown warning
- Full message history loaded from MongoDB on chat open (survives refresh)
- **Infinite scroll upward** to load older messages

### Message Status — Read Receipts (WhatsApp-style)
- **Single gray tick** — message reached the server (`sent`)
- **Double gray tick** — message delivered to the recipient's device (`delivered`)
- **Double blue tick** — message has been read (`read`)
- Status shown on every bubble and in the conversation list preview row
- Updates in real-time via Socket.IO — no polling, no refresh needed

### Online / Offline Presence
- Green dot on avatar when user is online
- Pulsing "Online" badge in the chat header
- "Last seen X ago" displayed when the user goes offline (updates instantly)
- Online list seeded from existing conversation participants on page load
- Kept in sync by `userOnline` / `userOffline` socket events

### Typing Indicator
- Animated three-dot bubble appears when the other user is typing
- Automatically clears after **2 seconds** of inactivity (debounced)
- Scoped per conversation — only shows in the relevant open chat

### Follow / Unfollow System
- **Public profiles** — follow is instant, no approval needed
- **Private profiles** — sends a follow request; owner must Accept or Decline
- Follow request badge on the profile page with animated counter
- Real-time notification (toast + UI update) when your request is accepted
- Unfollow from the profile button or from the Following list
- Remove a follower from your own Followers list

### Public / Private Profiles
- Profile type switch in Edit Profile (`public` or `private`)
- **Private** — posts/media completely hidden; lock screen shown to non-followers
- **Public** — posts visible to everyone, appear in the global feed
- "Follow to see posts" message with follow button shown inside the lock screen
- "Requested" status shown while a follow request is pending

### Posts & Feed
- Create posts with an image upload + optional caption from your profile
- Feed at `/posts` merges: your posts + followed users + all public accounts
- Like / Unlike with real-time count update
- Comment section per post
- Delete your own posts (with confirmation)
- Post count shown on your profile stats

### Message Requests (Instagram DM style)
- DM to a non-follower on a private account goes to their **Requests** tab
- Owner can **Accept** (moves to active chats) or **Decline**
- Badge counter on the Requests tab in the conversation list

### Profile Management
- Edit bio (up to 160 characters)
- Upload a custom avatar (image preview before save)
- Toggle public / private profile type
- View followers, following, and pending follow requests in a modal

---

## App Pages

| Route | Description |
|---|---|
| `/auth` | Login, Signup, Forgot Password (unified page) |
| `/messages` | Conversation list — active chats + message requests |
| `/messages/[id]` | Chat window for a specific conversation |
| `/people` | User discovery, search, follow / unfollow |
| `/profile/[username]` | User profile, posts, followers / following / requests |
| `/posts` | Global post feed |
| `/search` | User search |

---

## State Management (Zustand)

| Slice | Persisted | What it stores |
|---|---|---|
| Auth | Yes (localStorage) | `user`, `token` |
| Conversations | No (in-memory) | Active conversations, message requests, active conversation ID |
| Messages | No (in-memory) | Message arrays keyed by `conversationId` — cache avoids re-fetch on revisit |
| Presence | No (in-memory) | `onlineUsers` Set, `typingStates` array |

---

## Project Structure

```
frontend/
├── app/
│   ├── auth/             # Login / Signup / Forgot Password page
│   ├── messages/         # Conversation list page
│   ├── messages/[id]/    # Chat window page
│   ├── people/           # User discovery page
│   ├── posts/            # Post feed page
│   ├── profile/[username]/ # Profile page
│   └── search/           # Search page
├── components/
│   ├── chat/             # ChatWindow, ConversationList, MessageBubble, TypingIndicator, NewChatModal
│   ├── posts/            # PostForm, PostList, PostFeedTile, CommentSection
│   ├── layout/           # AppShell, Sidebar
│   └── ui/               # Avatar, Loader, Logo
├── hooks/
│   └── useSocket.ts      # Socket connection setup + useTyping hook
├── lib/
│   ├── api.ts            # Axios instance with JWT injection
│   ├── socket.ts         # Socket.IO client init / disconnect helpers
│   ├── dateUtils.ts      # formatTime, formatLastSeen, getMessageDateLabel
│   └── validation.ts     # Input validation helpers
├── store/
│   └── index.ts          # Zustand store (Auth + Conversations + Messages + Presence)
└── types/
    └── index.ts          # TypeScript interfaces (User, Message, Conversation, Post)
```

---

## Production Checklist

- [ ] Replace static OTP `123456` with a real email provider (Resend / SendGrid / Nodemailer) — show the actual code sent to the user's inbox
- [ ] Use `next/image` for all user-uploaded images (automatic optimization + CDN)
- [ ] Move file uploads to cloud storage (Cloudinary / AWS S3) — current disk storage is wiped on server restart
- [ ] Add PWA manifest + service worker (`next-pwa`) for mobile install and offline cache
- [ ] Web Push notifications so users get alerts when the browser tab is closed
- [ ] Add end-to-end encryption indicator in the chat UI once backend supports it
- [ ] Message edit and delete (with confirmation and "edited" label)
- [ ] Message reactions (emoji picker)
- [ ] Story / Status feature (24-hour expiry media)
- [ ] Group chat support (UI for creating a group, adding members)
- [ ] Voice and video calling (WebRTC — `simple-peer` or `mediasoup`)
- [ ] Dark / light mode toggle (currently dark-only)
- [ ] Multi-language support (i18n with `next-intl`)
- [ ] Virtual scroll for very large message lists (react-virtual)
- [ ] Unit tests for Zustand store slices (Jest / Vitest)
- [ ] E2E tests for auth and messaging flows (Playwright)
- [ ] CI/CD pipeline: GitHub Actions → Vercel deploy on push to main

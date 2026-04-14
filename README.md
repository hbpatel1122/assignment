# ChatSphere

A full-stack real-time social messaging application built for an interview assignment.

---

## Quick Start

### 1. Start the Backend
```bash
cd backend
npm install
npm run dev        # runs on http://localhost:5000
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:3000
```

> Both servers must be running at the same time.

### Demo OTP
All OTP prompts (signup verification, forgot password) use the static code:
```
123456
```
No real email is sent in this build.

---

## Tech Stack

| Side | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, Socket.IO Client, Framer Motion |
| Backend | Node.js, Express 5, Socket.IO 4, MongoDB (Mongoose 9), JWT, bcryptjs, Multer |

---

## Implemented Features

### Authentication
- Email + password **signup** with username uniqueness check
- Email + password **login** returning a 7-day JWT
- **Email OTP verification** on signup (demo code: `123456`)
- **Forgot password** flow — email → OTP → reset token → new password
- Auto-login on refresh (token persisted in `localStorage` via Zustand)
- Protected routes — redirects to `/auth` when unauthenticated

### User Search & Discovery
- `/people` page lists all registered users with **infinite scroll**
- **Live search** by username or email (debounced)
- Each card shows avatar, username, bio, online status, and follow button
- Follow button states: **Follow / Requested / Following**

### Follow / Unfollow System
- **Public profiles** — follow is instant
- **Private profiles** — sends a follow request; owner must Accept or Decline
- Cancel a pending request via the same Unfollow button
- Accept / Decline from the profile page or directly from the **Notification panel**
- **Real-time** — requester's UI updates instantly when their request is accepted (Socket.IO event)
- Remove followers from your own list

### Public / Private Profiles
- Toggle between `public` and `private` in Edit Profile
- **Private** — posts and media locked behind a gate for non-followers
- **Public** — posts visible to all and appear in the global feed
- Privacy badge (lock / globe icon) shown on every profile

### Real-time Messaging
- Messages sent via **Socket.IO** with automatic **REST fallback**
- **Offline queueing** — messages delivered instantly when recipient reconnects
- Image attachments (up to 10 MB)
- 2000-character limit with live countdown
- Full **message history** persisted in MongoDB (survives page refresh)
- **Infinite scroll upward** to load older messages

### Message Status — Read Receipts (WhatsApp-style)
- **Single gray tick** — sent to server
- **Double gray tick** — delivered to recipient's device
- **Double blue tick** — read by recipient
- Updates in real-time via Socket.IO on every message bubble and conversation list row

### Online / Offline Presence
- Green dot on avatar when user is online
- Pulsing "Online" badge in the chat header
- "Last seen X ago" — updates in real-time when the user disconnects
- Presence seeded from conversation participants, kept live by socket events

### Typing Indicator
- Animated three-dot bubble when the other user is typing
- Auto-clears after 2 seconds of inactivity (debounced)
- Scoped to the active conversation only

### Notifications (Bell icon in sidebar)
- **Follow request** — receive a notification when someone requests to follow you
- **New follower** — notification when someone follows your public account
- **Follow accepted** — notification when your follow request is approved
- **Real-time delivery** via Socket.IO — bell badge appears instantly
- **Red unread badge** on the bell icon with count
- **Dropdown panel** — shows avatar, action label, and time ago
- **Accept / Decline** follow requests directly from the notification panel
- **Mark all read** button — clears the badge
- Auto-marks all as read when the panel is opened
- Persisted in MongoDB — notifications survive page refresh

### Message Requests (Instagram DM style)
- DM to a non-follower on a private account goes to their **Requests** tab
- Accept moves the chat to active conversations; Decline removes it
- Badge counter on the Requests tab

### Posts & Feed
- Upload image posts with caption from your profile
- Feed shows posts from: yourself + followed users + all public accounts
- Like / Unlike with count
- Comment section per post
- Delete your own posts
- **Privacy enforced** — private account posts hidden from non-followers everywhere

### Profile Management
- Edit bio (up to 160 characters)
- Upload a custom avatar with preview
- Toggle public / private
- View followers, following, and pending follow requests in a modal
- Remove followers, unfollow from lists

---

## Project Structure

```
hardiz-assignment/
├── backend/
│   ├── controllers/        # authController, userController, messageController,
│   │                       # conversationController, postController, notificationController
│   ├── models/             # User, Message, Conversation, Post, Comment, Notification
│   ├── routes/             # auth, users, messages, conversations, posts, upload,
│   │                       # comments, notifications
│   ├── socket/             # Socket.IO event handlers
│   ├── middleware/         # JWT auth middleware
│   ├── uploads/            # Local file storage (avatars, posts, messages)
│   └── index.js            # Express + Socket.IO server entry point
│
└── frontend/
    ├── app/                # Next.js App Router pages
    │   ├── auth/           # Login / Signup / Forgot Password
    │   ├── messages/       # Conversation list + chat window
    │   ├── people/         # User discovery & search
    │   ├── posts/          # Post feed
    │   ├── profile/        # User profile page
    │   └── search/         # Search
    ├── components/
    │   ├── chat/           # ChatWindow, ConversationList, MessageBubble, TypingIndicator
    │   ├── notifications/  # NotificationPanel (bell dropdown)
    │   ├── posts/          # PostForm, PostList, PostFeedTile, CommentSection
    │   ├── layout/         # AppShell, Sidebar
    │   └── ui/             # Avatar, Loader, Logo
    ├── hooks/              # useSocket, useTyping
    ├── lib/                # api (Axios), socket, dateUtils, validation
    ├── store/              # Zustand store (Auth, Conversations, Messages, Presence, Notifications)
    └── types/              # TypeScript interfaces
```

---

## API Overview

| Module | Base Path | Key Endpoints |
|---|---|---|
| Auth | `/api/auth` | POST /signup, POST /login, POST /verify-email |
| Users | `/api/users` | GET /search, POST /:id/follow, POST /requests/:id/accept |
| Messages | `/api/messages` | GET /:conversationId, PUT /:conversationId/read |
| Conversations | `/api/conversations` | GET /, POST /, PUT /:id/accept |
| Posts | `/api/posts` | GET /feed, POST /, GET /user/:userId |
| Upload | `/api/upload` | POST / (post image), POST /message (chat image) |
| Notifications | `/api/notifications` | GET /, PUT /read-all, PUT /:id/read |

Static uploads served at: `http://localhost:5000/uploads/`

---

## Socket.IO Events

| Direction | Event | Description |
|---|---|---|
| Server → Client | `newMessage` | Incoming message |
| Server → Client | `messageStatus` | Delivery / read receipt update |
| Server → Client | `userOnline` / `userOffline` | Presence update |
| Server → Client | `typing` / `stopTyping` | Typing indicator |
| Server → Client | `followRequestAccepted` | Follow request approved (UI update) |
| Server → Client | `newNotification` | New notification pushed in real-time |
| Client → Server | `sendMessage` | Send a message |
| Client → Server | `markRead` | Mark messages as read |
| Client → Server | `typing` / `stopTyping` | Emit typing state |

---

## Production Improvements

- Replace static OTP `123456` with a real email provider (Resend / SendGrid)
- Move file uploads to cloud storage (Cloudinary / AWS S3) — current disk storage is ephemeral
- Add rate limiting on auth and upload endpoints (`express-rate-limit`)
- Use a strong random `JWT_SECRET` stored in a secrets manager
- Add refresh token rotation (current JWT is 7-day static)
- Enable HTTPS / TLS at the reverse proxy (Nginx / Caddy)
- Add push notifications (FCM) for offline users
- Implement message edit / delete
- Add message reactions (emoji)
- Group chat support
- End-to-end encryption
- Voice / video calling (WebRTC)
- CI/CD pipeline — GitHub Actions → Vercel (frontend) + Railway/Render (backend)
#   a s s i g n m e n t  
 
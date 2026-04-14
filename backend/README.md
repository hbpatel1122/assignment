# ChatSphere — Backend API

REST + WebSocket server built with **Node.js**, **Express**, **Socket.IO**, and **MongoDB (Mongoose)**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 5 |
| Real-time | Socket.IO 4 |
| Database | MongoDB Atlas via Mongoose 9 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| File Uploads | Multer (local disk storage) |

---

## Getting Started

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
Create a `.env` file (already present):
```env
PORT=5000
MONGO_URI=<your MongoDB Atlas connection string>
JWT_SECRET=supersecretjwtkey_changeinprod_2024
CLIENT_URL=http://localhost:3000
```

### 3. Run the server
```bash
# Development (auto-restarts on file change)
npm run dev

# Production
npm start
```

Server starts at **http://localhost:5000**

---

## Demo Notes

### OTP / Email Verification
> All OTP flows use the **static code `123456`** — no real email is sent in this build.

This applies to:
- Email verification after signup (`POST /api/auth/verify-email`)
- Forgot password OTP (`POST /api/auth/forgot-password`)
- Reset password OTP verification (`POST /api/auth/verify-reset-otp`)

**For the demo:** enter `123456` whenever the app asks for an OTP.

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/signup` | Register with username, email, password | No |
| POST | `/login` | Login with email, password → returns JWT | No |
| GET | `/me` | Get current logged-in user | Yes |
| POST | `/verify-email` | Verify email with OTP (use `123456`) | Yes |
| POST | `/resend-otp` | Resend verification OTP | Yes |
| POST | `/forgot-password` | Request password reset OTP | No |
| POST | `/verify-reset-otp` | Verify reset OTP → returns resetToken | No |
| POST | `/reset-password` | Set new password with resetToken | No |

---

### Users — `/api/users`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/` | List all users (paginated, with follow status) | Yes |
| GET | `/search?q=` | Search users by username or email | Yes |
| GET | `/:username` | Get user profile with followers/following | Yes |
| PUT | `/profile/update` | Update bio, avatar URL, profileType | Yes |
| POST | `/avatar` | Upload avatar image (multipart/form-data) | Yes |
| POST | `/:id/follow` | Follow user (instant if public, request if private) | Yes |
| POST | `/:id/unfollow` | Unfollow or cancel follow request | Yes |
| POST | `/:id/remove-follower` | Remove a follower from your list | Yes |
| POST | `/requests/:id/accept` | Accept a follow request | Yes |
| POST | `/requests/:id/reject` | Reject a follow request | Yes |

---

### Messages — `/api/messages`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/:conversationId` | Fetch message history (paginated, `?page=1&limit=40`) | Yes |
| POST | `/` | Send message via REST (Socket.IO preferred) | Yes |
| PUT | `/:conversationId/read` | Mark all messages in conversation as read | Yes |

---

### Conversations — `/api/conversations`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/` | List active conversations (paginated) | Yes |
| GET | `/requests` | List message requests (pending) | Yes |
| POST | `/` | Create or get existing conversation | Yes |
| GET | `/:id` | Get a specific conversation | Yes |
| PUT | `/:id/accept` | Accept a message request | Yes |
| DELETE | `/:id/decline` | Decline a message request | Yes |
| DELETE | `/:id` | Delete conversation + all its messages | Yes |

---

### Posts — `/api/posts`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/` | Create a post (requires `imageUrl`) | Yes |
| GET | `/feed` | Get feed (own + following + public) | Yes |
| GET | `/user/:userId` | Get a user's posts (privacy enforced) | Yes |
| DELETE | `/:postId` | Delete own post | Yes |
| POST | `/:postId/like` | Like a post | Yes |
| POST | `/:postId/unlike` | Unlike a post | Yes |

---

### Upload — `/api/upload`

| Method | Endpoint | Description | Max Size |
|---|---|---|---|
| POST | `/` | Upload post image → returns `{ url }` | 5 MB |
| POST | `/message` | Upload message media image → returns `{ url }` | 10 MB |

Accepted types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

Uploaded files served statically at: `http://localhost:5000/uploads/...`

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `sendMessage` | `{ conversationId, content, mediaUrl?, mediaType? }` | Send a message |
| `typing` | `{ conversationId, recipientId }` | Notify recipient you are typing |
| `stopTyping` | `{ conversationId, recipientId }` | Notify recipient you stopped typing |
| `markRead` | `{ conversationId, senderId }` | Mark all messages from sender as read |

All socket connections require a valid JWT passed in `socket.handshake.auth.token`.

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `onlineUsers` | `{ userIds: string[] }` | Full online list sent on connect |
| `userOnline` | `{ userId }` | A user just came online |
| `userOffline` | `{ userId, lastSeen }` | A user went offline |
| `newMessage` | `{ message }` | Incoming message from another user |
| `messageStatus` | `{ conversationId, status, messageId?, readBy? }` | Delivery / read receipt update |
| `typing` | `{ conversationId, userId, username }` | Someone is typing |
| `stopTyping` | `{ conversationId, userId }` | Someone stopped typing |
| `followRequestAccepted` | `{ acceptedBy, username }` | Your follow request was accepted |

---

## Data Models

### User
```
username, email, password (hashed), avatar, bio
profileType: 'public' | 'private'
followers[], following[], followRequests[]
isOnline, lastSeen, isEmailVerified
```

### Message
```
conversationId, sender, content, mediaUrl, mediaType
type: 'text' | 'image'
status: 'sent' | 'delivered' | 'read'
readBy[]
```

### Conversation
```
participants[2], lastMessage, status: 'active' | 'request'
requestedBy (sender of message request)
```

### Post
```
author, imageUrl, caption, likes[]
```

---

## Privacy Rules

| Profile Type | Follow | View Posts | Message |
|---|---|---|---|
| Public | Instant follow | Anyone can see | Anyone can DM |
| Private | Requires approval | Followers only | Non-followers get message request |

---

## Production Checklist

- [ ] Replace static OTP `123456` with a real email provider (Nodemailer + SendGrid / Resend / AWS SES)
- [ ] Move uploaded files to cloud storage (AWS S3, Cloudinary, or similar) — current disk storage is ephemeral on most hosts
- [ ] Add rate limiting (`express-rate-limit`) on auth and upload endpoints
- [ ] Use a proper `JWT_SECRET` (min 32 random chars, stored in secrets manager)
- [ ] Add request validation middleware (`express-validator` is already installed but not used on all routes)
- [ ] Enable HTTPS / TLS (terminate at reverse proxy — Nginx or Caddy)
- [ ] Add a process manager (PM2) and health-check endpoint (already has `/health`)
- [ ] Add refresh token rotation — current JWT is 7-day static
- [ ] Encrypt messages at rest (application-level AES or MongoDB Field Level Encryption)
- [ ] Add message edit / delete endpoints
- [ ] Push notifications (FCM / APNs) for offline users instead of relying solely on Socket.IO
- [ ] Add group conversation support (model supports N participants already)
- [ ] Set up MongoDB indexes for production query performance (partial indexes exist)
- [ ] Add logging (Winston / Pino) and error monitoring (Sentry)

export interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  profileType: 'public' | 'private';
  followers: User[] | string[];
  following: User[] | string[];
  followRequests: User[] | string[];
  isEmailVerified: boolean;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: User;
  content: string;
  type: 'text' | 'image';
  mediaUrl?: string | null;
  mediaType?: 'image' | null;
  status: 'sent' | 'delivered' | 'read';
  readBy: string[];
  createdAt: string;
}

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: Message | null;
  updatedAt: string;
  createdAt: string;
  status: 'active' | 'request';
  requestedBy?: string | null;
}

export interface TypingState {
  conversationId: string;
  userId: string;
  username: string;
}

export interface Post {
  _id: string;
  author: User;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string;
  createdAt: string;
  likes: string[]; // Array of user IDs who liked
  commentCount?: number;
}

// User extended with follow status (returned from /api/users and /api/users/search)
export interface UserWithStatus extends User {
  isFollowing: boolean;
  hasRequested: boolean;
}

export interface Notification {
  _id: string;
  recipient: string;
  sender: Pick<User, '_id' | 'username' | 'avatar'>;
  type: 'follow_request' | 'follow_accepted' | 'new_follower';
  read: boolean;
  createdAt: string;
}

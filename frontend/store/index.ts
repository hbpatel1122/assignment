import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Conversation, Message, TypingState, Notification } from '@/types';

interface AuthSlice {
  user: User | null;
  token: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

interface ConversationSlice {
  conversations: Conversation[];
  messageRequests: Conversation[];
  activeConversationId: string | null;
  setConversations: (c: Conversation[]) => void;
  appendConversations: (c: Conversation[]) => void;
  addConversation: (c: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  updateConversationLastMessage: (conversationId: string, msg: Message) => void;
  /** Update only the status field of a conversation's lastMessage (for sent→delivered→read transitions) */
  updateConversationLastMessageStatus: (conversationId: string, status: Message['status'], messageId?: string) => void;
  removeConversation: (id: string) => void;
  setMessageRequests: (c: Conversation[]) => void;
  addMessageRequest: (c: Conversation) => void;
  removeMessageRequest: (id: string) => void;
  promoteRequestToConversation: (id: string) => void;
}

interface MessageSlice {
  messages: Record<string, Message[]>;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  prependMessages: (conversationId: string, msgs: Message[]) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  /** Pass messageId to update a single message, senderId to update all messages by that sender,
   *  or neither to update every message in the conversation. */
  updateMessageStatus: (
    conversationId: string,
    status: string,
    senderId?: string,
    messageId?: string
  ) => void;
}

interface PresenceSlice {
  onlineUsers: Set<string>;
  typingStates: TypingState[];
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string, lastSeen?: string) => void;
  setTyping: (state: TypingState) => void;
  clearTyping: (conversationId: string, userId: string) => void;
}

interface NotificationSlice {
  notifications: Notification[];
  unreadNotifCount: number;
  setNotifications: (notifs: Notification[], unreadCount: number) => void;
  appendNotifications: (notifs: Notification[]) => void;
  prependNotification: (notif: Notification) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

type Store = AuthSlice & ConversationSlice & MessageSlice & PresenceSlice & NotificationSlice;

export const useStore = create<Store>()(
  persist(
    (set) => ({
      // ── Auth ──────────────────────────────────────────────
      user: null,
      token: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') localStorage.setItem('token', token);
        set({ user, token });
      },
      updateUser: (updates) =>
        set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
        set({ user: null, token: null, conversations: [], messages: {}, onlineUsers: new Set() });
      },

      // ── Conversations ─────────────────────────────────────
      conversations: [],
      messageRequests: [],
      activeConversationId: null,

      /**
       * Load conversations AND seed the onlineUsers Set from participant data.
       * Socket events keep it up-to-date after this point.
       */
      setConversations: (conversations) =>
        set((s) => {
          // Seed online presence from freshly-loaded DB data
          const onlineIds = new Set(s.onlineUsers);
          conversations.forEach((c) =>
            c.participants.forEach((p) => {
              if (p.isOnline) onlineIds.add(p._id);
            })
          );
          return { conversations, onlineUsers: onlineIds };
        }),

      appendConversations: (incoming) =>
        set((s) => {
          const existingIds = new Set(s.conversations.map((c) => c._id));
          const fresh = incoming.filter((c) => !existingIds.has(c._id));
          const onlineIds = new Set(s.onlineUsers);
          fresh.forEach((c) =>
            c.participants.forEach((p) => { if (p.isOnline) onlineIds.add(p._id); })
          );
          return { conversations: [...s.conversations, ...fresh], onlineUsers: onlineIds };
        }),

      addConversation: (c) =>
        set((s) => {
          const exists = s.conversations.find((x) => x._id === c._id);
          if (exists) return {};
          // Also seed online status for new conversation participants
          const onlineIds = new Set(s.onlineUsers);
          c.participants.forEach((p) => {
            if (p.isOnline) onlineIds.add(p._id);
          });
          return { conversations: [c, ...s.conversations], onlineUsers: onlineIds };
        }),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      removeConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c._id !== id),
        })),

      setMessageRequests: (messageRequests) => set({ messageRequests }),

      addMessageRequest: (c) =>
        set((s) => {
          const exists = s.messageRequests.find((x) => x._id === c._id);
          if (exists) return {};
          return { messageRequests: [c, ...s.messageRequests] };
        }),

      removeMessageRequest: (id) =>
        set((s) => ({
          messageRequests: s.messageRequests.filter((c) => c._id !== id),
        })),

      promoteRequestToConversation: (id) =>
        set((s) => {
          const req = s.messageRequests.find((c) => c._id === id);
          if (!req) return {};
          const promoted = { ...req, status: 'active' as const, requestedBy: null };
          const alreadyExists = s.conversations.find((c) => c._id === id);
          return {
            messageRequests: s.messageRequests.filter((c) => c._id !== id),
            conversations: alreadyExists
              ? s.conversations
              : [promoted, ...s.conversations],
          };
        }),

      updateConversationLastMessage: (conversationId, msg) =>
        set((s) => ({
          conversations: s.conversations
            .map((c) =>
              c._id === conversationId
                ? { ...c, lastMessage: msg, updatedAt: msg.createdAt }
                : c
            )
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        })),

      updateConversationLastMessageStatus: (conversationId, status, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c._id !== conversationId || !c.lastMessage) return c;
            // If a specific messageId is given, only update if it matches the lastMessage
            if (messageId && c.lastMessage._id !== messageId) return c;
            return { ...c, lastMessage: { ...c.lastMessage, status } };
          }),
        })),

      // ── Messages ─────────────────────────────────────────
      messages: {},
      setMessages: (conversationId, msgs) =>
        set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),

      prependMessages: (conversationId, msgs) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [conversationId]: [...msgs, ...(s.messages[conversationId] || [])],
          },
        })),

      addMessage: (conversationId, msg) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [conversationId]: [...(s.messages[conversationId] || []), msg],
          },
        })),

      updateMessageStatus: (conversationId, status, senderId, messageId) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [conversationId]: (s.messages[conversationId] || []).map((m) => {
              // Exact message match (used for delivered-on-reconnect)
              if (messageId) {
                return m._id === messageId
                  ? { ...m, status: status as Message['status'] }
                  : m;
              }
              // All messages by a specific sender (used for read receipts)
              if (senderId) {
                return m.sender._id === senderId
                  ? { ...m, status: status as Message['status'] }
                  : m;
              }
              // Bulk fallback
              return { ...m, status: status as Message['status'] };
            }),
          },
        })),

      // ── Presence ─────────────────────────────────────────
      onlineUsers: new Set(),
      typingStates: [],

      setUserOnline: (userId) =>
        set((s) => ({ onlineUsers: new Set([...s.onlineUsers, userId]) })),

      setUserOffline: (userId, lastSeen) =>
        set((s) => {
          const next = new Set(s.onlineUsers);
          next.delete(userId);
          // Update lastSeen in all conversations where this user is a participant
          const conversations = s.conversations.map((c) => ({
            ...c,
            participants: c.participants.map((p) =>
              p._id === userId
                ? { ...p, isOnline: false, ...(lastSeen ? { lastSeen } : {}) }
                : p
            ),
          }));
          return { onlineUsers: next, conversations };
        }),

      setTyping: (state) =>
        set((s) => ({
          typingStates: [
            ...s.typingStates.filter(
              (t) => !(t.conversationId === state.conversationId && t.userId === state.userId)
            ),
            state,
          ],
        })),

      clearTyping: (conversationId, userId) =>
        set((s) => ({
          typingStates: s.typingStates.filter(
            (t) => !(t.conversationId === conversationId && t.userId === userId)
          ),
        })),

      // ── Notifications ─────────────────────────────────────
      notifications: [],
      unreadNotifCount: 0,

      setNotifications: (notifs, unreadCount) => {
        // Deduplicate by _id in case stale records slipped through
        const seen = new Set<string>();
        const deduped = notifs.filter((n) => {
          if (seen.has(n._id)) return false;
          seen.add(n._id);
          return true;
        });
        set({ notifications: deduped, unreadNotifCount: unreadCount });
      },

      appendNotifications: (notifs) =>
        set((s) => {
          const existingIds = new Set(s.notifications.map((n) => n._id));
          const fresh = notifs.filter((n) => !existingIds.has(n._id));
          return { notifications: [...s.notifications, ...fresh] };
        }),

      prependNotification: (notif) =>
        set((s) => {
          // Skip if already in the list (socket fired while fetch was in-flight)
          if (s.notifications.some((n) => n._id === notif._id)) return {};
          return {
            notifications: [notif, ...s.notifications],
            unreadNotifCount: s.unreadNotifCount + 1,
          };
        }),

      markNotifRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n._id === id ? { ...n, read: true } : n
          ),
          unreadNotifCount: Math.max(0, s.unreadNotifCount - (s.notifications.find((n) => n._id === id && !n.read) ? 1 : 0)),
        })),

      markAllNotifsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadNotifCount: 0,
        })),

      removeNotification: (id) =>
        set((s) => {
          const notif = s.notifications.find((n) => n._id === id);
          return {
            notifications: s.notifications.filter((n) => n._id !== id),
            unreadNotifCount: notif && !notif.read
              ? Math.max(0, s.unreadNotifCount - 1)
              : s.unreadNotifCount,
          };
        }),

      clearAllNotifications: () =>
        set({ notifications: [], unreadNotifCount: 0 }),
    }),
    {
      name: 'chatapp-store',
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

'use client';
import { useEffect, useRef } from 'react';
import { initSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useStore } from '@/store';
import { Message, Notification } from '@/types';

export const useSocketSetup = () => {
  const token = useStore((s) => s.token);
  // Use stable primitive (string) instead of the user object to avoid an
  // infinite reconnect loop: updateUser() creates a new object reference
  // which would re-trigger the effect, disconnect the socket, and repeat.
  const userId = useStore((s) => s.user?._id);
  const {
    setUserOnline, setUserOffline, addMessage,
    updateConversationLastMessage, updateMessageStatus,
    updateConversationLastMessageStatus,
    setTyping, clearTyping, updateUser,
    prependNotification,
  } = useStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || !userId || initialized.current) return;
    initialized.current = true;

    const socket = initSocket(token);

    socket.on('connect', () => {
      console.log('Socket connected');
      updateUser({ isOnline: true });
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      updateUser({ isOnline: false });
      setUserOffline(userId);
    });

    // ── Online / Offline presence ────────────────────────────
    // Seed full online list on connect (so we don't miss users already online)
    socket.on('onlineUsers', ({ userIds }: { userIds: string[] }) => {
      userIds.forEach((id) => setUserOnline(id));
    });

    socket.on('userOnline', ({ userId: uid }: { userId: string }) => {
      setUserOnline(uid);
    });

    socket.on('userOffline', ({ userId: uid, lastSeen }: { userId: string; lastSeen: string }) => {
      setUserOffline(uid, lastSeen);
    });

    // ── Incoming messages ────────────────────────────────────
    socket.on('newMessage', ({ message }: { message: Message }) => {
      addMessage(message.conversationId, message);

      // If the message arrived in the currently open conversation, mark it as
      // read immediately so the sender sees blue ticks without any delay.
      const { activeConversationId } = useStore.getState();
      if (activeConversationId === message.conversationId) {
        socket.emit('markRead', {
          conversationId: message.conversationId,
          senderId: message.sender._id,
        });
        // Update lastMessage with read status so the unread dot doesn't flash
        updateConversationLastMessage(message.conversationId, { ...message, status: 'read' });
      } else {
        updateConversationLastMessage(message.conversationId, message);
      }
    });

    // ── Message status updates ───────────────────────────────
    /**
     * Two shapes come from the server:
     *
     * 1. Per-message delivered (on reconnect):
     *    { messageId, conversationId, status: 'delivered' }
     *    → update exactly that one message
     *
     * 2. Bulk read (when other user reads our messages):
     *    { conversationId, status: 'read', readBy: <their userId> }
     *    → update all messages WE sent in that conversation to 'read'
     *      (because readBy tells us WHO read them, so the messages
     *       that got read are the ones WE sent — sender = me)
     */
    socket.on('messageStatus', ({
      conversationId,
      status,
      readBy,
      messageId,
    }: {
      conversationId: string;
      status: string;
      readBy?: string;
      messageId?: string;
    }) => {
      if (messageId) {
        // Delivered: update exactly this message
        updateMessageStatus(conversationId, status, undefined, messageId);
        // Update conversation lastMessage only if it's this specific message
        updateConversationLastMessageStatus(
          conversationId,
          status as 'sent' | 'delivered' | 'read',
          messageId,
        );
      } else if (readBy) {
        // Read: readBy is the person who read our messages.
        // We need to update messages WE sent (sender = current user).
        const me = useStore.getState().user;
        if (me) {
          updateMessageStatus(conversationId, status, me._id);
        }
        // Mark conversation lastMessage as read (no messageId filter — all are read)
        updateConversationLastMessageStatus(
          conversationId,
          status as 'sent' | 'delivered' | 'read',
        );
      } else {
        // Fallback: update all messages in conversation
        updateMessageStatus(conversationId, status);
        updateConversationLastMessageStatus(
          conversationId,
          status as 'sent' | 'delivered' | 'read',
        );
      }
    });

    // ── Typing indicators ────────────────────────────────────
    socket.on('typing', ({ conversationId, userId, username }: {
      conversationId: string;
      userId: string;
      username: string;
    }) => {
      setTyping({ conversationId, userId, username });
    });

    socket.on('stopTyping', ({ conversationId, userId }: {
      conversationId: string;
      userId: string;
    }) => {
      clearTyping(conversationId, userId);
    });

    // ── Notifications ────────────────────────────────────
    socket.on('newNotification', ({ notification }: { notification: Notification }) => {
      prependNotification(notification);
    });

    return () => {
      initialized.current = false;
      disconnectSocket();
    };
  }, [token, userId]); // userId is a stable string — object deps cause infinite reconnects
};

// ── Typing hook ──────────────────────────────────────────────────
export const useTyping = (conversationId: string, recipientId: string) => {
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing', { conversationId, recipientId });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('stopTyping', { conversationId, recipientId });
    }, 2000);
  };

  const stopTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socket.emit('stopTyping', { conversationId, recipientId });
  };

  return { sendTyping, stopTyping };
};

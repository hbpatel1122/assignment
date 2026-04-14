'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import { useSocketSetup } from '@/hooks/useSocket';
import Sidebar from './Sidebar';
import Loader from '@/components/ui/Loader';
import api from '@/lib/api';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token, _hasHydrated, setConversations, setMessageRequests, conversations } = useStore();

  useSocketSetup();

  // Load conversations once on mount so the sidebar unread badge is always accurate,
  // regardless of which page the user lands on first.
  useEffect(() => {
    if (!user || !token) return;
    // Skip if already populated (e.g. ConversationList loaded them first)
    if (conversations.length > 0) return;
    Promise.all([
      api.get('/conversations?page=1&limit=20').then(({ data }) => setConversations(data.conversations)),
      api.get('/conversations/requests').then(({ data }) => setMessageRequests(data.conversations)),
    ]).catch(() => {/* silently ignore — ConversationList will retry on its own page */});
  }, [user, token]);

  useEffect(() => {
    if (!_hasHydrated) return; // wait for persisted state to load
    if (!user || !token) {
      router.replace('/auth');
    } else if (!user.isEmailVerified) {
      router.replace('/auth/verify-email');
    }
  }, [user, token, _hasHydrated, router]);

  // Still loading persisted state — show spinner, don't redirect
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader size="lg" color="bg-indigo-500" />
      </div>
    );
  }

  if (!user || !token || !user.isEmailVerified) return null;

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 md:ml-64 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}

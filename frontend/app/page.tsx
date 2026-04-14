'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import Loader from '@/components/ui/Loader';

export default function RootPage() {
  const router = useRouter();
  const { user, token, _hasHydrated } = useStore();

  useEffect(() => {
    // Wait for persisted store to rehydrate before redirecting.
    // Without this, user/token are null on first render even when logged in,
    // causing a spurious redirect to /auth.
    if (!_hasHydrated) return;

    if (user && token) {
      router.replace(user.isEmailVerified ? '/messages' : '/auth/verify-email');
    } else {
      router.replace('/auth');
    }
  }, [user, token, _hasHydrated, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader size="lg" color="bg-indigo-500" />
    </div>
  );
}

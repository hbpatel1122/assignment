'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import Loader from '@/components/ui/Loader';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { User } from '@/types';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data.users);
      setSearched(true);
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    const timer = setTimeout(() => search(val), 350);
    return () => clearTimeout(timer);
  };

  const startChat = async (userId: string) => {
    setStartingChat(userId);
    const id = toast.loading('Opening conversation…');
    try {
      const { data } = await api.post('/conversations', { userId });
      toast.success('Conversation ready!', { id });
      router.push(`/messages/${data.conversation._id}`);
    } catch {
      toast.error('Could not open conversation');
    } finally {
      setStartingChat(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Find People</h1>
        <p className="text-gray-400 text-sm mb-6">
          Search by username or email to connect with others
        </p>

        {/* Search box */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {loading ? (
              <Loader size="sm" color="bg-indigo-400" />
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search username or email…"
            autoFocus
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
              className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {!searched && !query && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">Search for people</p>
              <p className="text-gray-600 text-sm mt-1">Type at least 1 character to search</p>
            </motion.div>
          )}

          {searched && results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <p className="text-gray-400 font-medium">No users found</p>
              <p className="text-gray-600 text-sm mt-1">Try a different search term</p>
            </motion.div>
          )}

          {results.length > 0 && (
            <motion.ul
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {results.map((u, i) => (
                <motion.li
                  key={u._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-500/40 transition-all"
                >
                  <Avatar user={u} size="lg" showOnline />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold text-sm">{u.username}</p>
                      {u.profileType === 'private' && (
                        <span className="bg-gray-800 border border-gray-700 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs truncate">{u.email}</p>
                    {u.bio && <p className="text-gray-400 text-xs mt-0.5 truncate">{u.bio}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/profile/${u.username}`)}
                      className="px-3 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => startChat(u._id)}
                      disabled={startingChat === u._id}
                      className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg transition flex items-center gap-1"
                    >
                      {startingChat === u._id ? (
                        <Loader size="sm" />
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Message
                        </>
                      )}
                    </button>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

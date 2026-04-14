'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import PostFeedTile from '@/components/posts/PostFeedTile';
import api from '@/lib/api';
import { Post } from '@/types';
import { useStore } from '@/store';

/* ── Delete confirmation modal ───────────────────────────────── */
function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-white text-lg font-bold mb-1">Delete post?</h3>
        <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition">
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Post skeleton card ─────────────────────────────────────── */
function PostSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full shimmer shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-3 w-28 rounded-full shimmer" />
          <div className="h-2.5 w-20 rounded-full shimmer" />
        </div>
      </div>
      {/* image */}
      <div className="w-full h-64 shimmer" />
      {/* caption */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="h-2.5 w-3/4 rounded-full shimmer" />
        <div className="h-2.5 w-1/2 rounded-full shimmer" />
      </div>
    </div>
  );
}

function useInfiniteScroll(callback: () => void, hasMore: boolean, loading: boolean) {
  useEffect(() => {
    if (!hasMore || loading) return;
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 400 &&
        !loading &&
        hasMore
      ) {
        callback();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [callback, hasMore, loading]);
}

export default function PostsPage() {
  const router = useRouter();
  const { user: me } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Track which authors we follow (seed from store, update on follow clicks)
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => {
    const following = (me?.following ?? []) as string[];
    return new Set(following.map(String));
  });
  // Keep followedIds in sync with store user.following
  useEffect(() => {
    const following = (me?.following ?? []) as string[];
    setFollowedIds(new Set(following.map(String)));
  }, [me?.following]);
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const updateUser = useStore((s) => s.updateUser);
  const handleFollow = async (authorId: string, username: string) => {
    setFollowLoading(authorId);
    try {
      await api.post(`/users/${authorId}/follow`);
      setFollowedIds((prev) => new Set([...prev, authorId]));
      // Update the user store so following is correct after refresh
      updateUser && updateUser({ following: [...(me?.following ?? []), authorId] });
      toast.success(`Following ${username}`);
    } catch {
      toast.error('Failed to follow');
    } finally {
      setFollowLoading(null);
    }
  };

  const fetchPosts = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/posts/feed?page=${page}&pageSize=${pageSize}`);
      if (Array.isArray(data.posts)) {
        setPosts((prev) => [...prev, ...data.posts]);
        setHasMore(data.hasMore ?? data.posts.length === pageSize);
        setPage((p) => p + 1);
      }
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  // Initial load
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line
  }, []);

  useInfiniteScroll(fetchPosts, hasMore, loading);

  return (
    <AppShell>
      <div className="max-w-[470px] mx-auto py-4 md:py-8">
        <div className="px-4 mb-4 hidden md:block">
          <h1 className="text-xl font-bold text-white">Posts</h1>
        </div>

        {/* ── Shimmer skeletons on initial load ── */}
        <AnimatePresence mode="wait">
          {loading && posts.length === 0 && (
            <motion.div
              key="skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-0"
            >
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <PostSkeleton />
                </motion.div>
              ))}
            </motion.div>
          )}

          {!loading && posts.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-16">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">No posts yet</p>
              <p className="text-gray-600 text-sm mt-1">Your posts and posts from people you follow will appear here</p>
            </motion.div>
          )}
        </AnimatePresence>

        {posts.length > 0 && (
          <div className="border-t border-gray-800/50">
            {Array.from(new Map(posts.map(post => [post._id, post])).values()).map((post, i) => (
              <motion.div
                key={post._id + '-' + i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 5) * 0.04 }}
              >
                <PostFeedTile
                  post={post}
                  me={me}
                  onLike={async () => {
                    try {
                      if (!me?._id) return toast.error('Login required');
                      const liked = post.likes?.includes(me._id);
                      const { data } = await api.post(`/posts/${post._id}/${liked ? 'unlike' : 'like'}`);
                      setPosts((prev) => prev.map((p) => p._id === post._id ? data.post : p));
                    } catch {
                      toast.error('Failed to update like');
                    }
                  }}
                  onFollow={() => handleFollow(post.author._id, post.author.username)}
                  followed={followedIds.has(post.author._id) || post.author._id === me?._id}
                  followLoading={followLoading === post.author._id}
                  onDelete={post.author._id === me?._id ? () => setPendingDeleteId(post._id) : undefined}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Load more shimmer */}
        {loading && posts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 space-y-4"
          >
            {[0, 1].map((i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <PostSkeleton />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="text-center py-6 text-gray-600 text-sm">
            You've reached the end
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDeleteId && (
          <DeleteConfirmModal
            onConfirm={() => {
              const id = pendingDeleteId;
              setPendingDeleteId(null);
              api.delete(`/posts/${id}`)
                .then(() => {
                  setPosts((prev) => prev.filter((p) => p._id !== id));
                  toast.success('Post deleted');
                })
                .catch(() => toast.error('Failed to delete'));
            }}
            onCancel={() => setPendingDeleteId(null)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

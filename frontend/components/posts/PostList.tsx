'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import CommentSection from './CommentSection';
import Avatar from '@/components/ui/Avatar';
import { Post, User } from '@/types';
import api, { resolveMediaUrl } from '@/lib/api';

/* ─── Delete confirmation modal ─────────────────────────────── */
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
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6 text-center"
      >
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-white text-lg font-bold mb-1">Delete post?</h3>
        <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface PostListProps {
  posts: Post[];
  isOwner: boolean;
  onDelete: (postId: string) => void;
  /** Current logged-in user — needed for like state */
  me?: User | null;
  /** Called with the updated post after a like/unlike succeeds */
  onLike?: (updatedPost: Post) => void;
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 604800) return `${Math.floor(d / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Comment bottom-sheet (shared by PostModal) ────────────── */
function CommentModal({
  post,
  onClose,
  onCountChange,
}: {
  post: Post;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full sm:max-w-lg bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar user={post.author} size="sm" />
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{post.author.username}</p>
              {post.caption && (
                <p className="text-gray-400 text-xs leading-tight line-clamp-1">{post.caption}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable comments */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <CommentSection
            postId={post._id}
            autoFocus
            onCountChange={onCountChange}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Instagram-style post modal ───────────────────────────── */
function PostModal({
  post,
  isOwner,
  me,
  onClose,
  onDelete,
  onLike,
  onCommentCountChange,
}: {
  post: Post;
  isOwner: boolean;
  me?: User | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onLike?: (updatedPost: Post) => void;
  onCommentCountChange?: (postId: string, count: number) => void;
}) {
  const router = useRouter();
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [muted, setMuted] = useState(true);
  const isVideo = post.mediaType === 'video';

  // ── Optimistic like state ──────────────────────────────────
  const [likesOverride, setLikesOverride] = useState<string[] | null>(null);
  const prevLikesRef = useRef(post.likes);
  useEffect(() => {
    if (post.likes !== prevLikesRef.current) {
      prevLikesRef.current = post.likes;
      setLikesOverride(null);
    }
  }, [post.likes]);

  const effectiveLikes = likesOverride ?? post.likes ?? [];
  const liked = !!me?._id && effectiveLikes.includes(me._id);
  const likeCount = effectiveLikes.length;
  const [liking, setLiking] = useState(false);

  // Fetch comment count
  useEffect(() => {
    let mounted = true;
    api.get(`/comments/${post._id}?page=1&pageSize=1`)
      .then(({ data }) => { if (mounted) setCommentCount(data.total || 0); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [post._id]);

  const handleLike = async () => {
    if (!me?._id || liking) return;
    setLiking(true);
    const newLikes = liked
      ? effectiveLikes.filter((id) => id !== me._id)
      : [...effectiveLikes, me._id];
    setLikesOverride(newLikes);
    try {
      const { data } = await api.post(`/posts/${post._id}/${liked ? 'unlike' : 'like'}`);
      onLike?.(data.post);
    } catch {
      setLikesOverride(null);
      toast.error('Failed to update like');
    } finally {
      setLiking(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

        {/* Close — floats top-right of viewport */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── Mobile: bottom sheet ── */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          className="md:hidden relative z-10 w-full bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl flex flex-col fixed bottom-0 left-0 right-0"
          style={{ maxHeight: '92vh' }}
        >
          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>

          {/* author row */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 shrink-0">
            <button onClick={() => { onClose(); router.push(`/profile/${post.author.username}`); }} className="shrink-0">
              <Avatar user={post.author} size="sm" />
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={() => { onClose(); router.push(`/profile/${post.author.username}`); }}
                className="text-white text-sm font-semibold hover:underline leading-tight block truncate">
                {post.author.username}
              </button>
              <p className="text-gray-500 text-[11px]">{timeAgo(post.createdAt)}</p>
            </div>
          </div>

          {/* image / video */}
          <div className="relative w-full bg-black shrink-0" style={{ maxHeight: '45vh' }}>
            {isVideo ? (
              <>
                <video
                  src={resolveMediaUrl(post.mediaUrl)}
                  controls
                  muted={muted}
                  playsInline
                  autoPlay
                  loop
                  className="w-full object-contain bg-black"
                  style={{ maxHeight: '45vh', background: '#000' }}
                />
                {/* Video badge */}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1 pointer-events-none">
                  <svg className="w-3 h-3 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  <span className="text-white text-[10px] font-semibold tracking-wide">VIDEO</span>
                </div>
                {/* Mute toggle */}
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition"
                >
                  {muted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <img
                src={resolveMediaUrl(post.mediaUrl)}
                alt={post.caption || 'Post'}
                className="w-full object-contain"
                style={{ maxHeight: '45vh' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* actions */}
          <div className="px-4 pt-3 pb-4 shrink-0 space-y-2">
            {/* caption */}
            {post.caption && (
              <p className="text-sm text-gray-200 leading-relaxed">
                <span className="font-semibold text-white mr-1.5">{post.author.username}</span>
                {post.caption}
              </p>
            )}

            {/* like + comment */}
            <div className="flex items-center gap-4 pt-1">
              <motion.button whileTap={{ scale: 0.8 }} onClick={handleLike} disabled={liking}
                className="flex items-center gap-1.5 group">
                <svg className={`w-6 h-6 transition-all duration-150 ${liked ? 'fill-pink-500 stroke-pink-500' : 'fill-none stroke-gray-200 group-hover:stroke-pink-400'}`}
                  viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12.54 3.81 13.07 5.09C13.6 3.81 15.1 3 16.64 3C19.72 3 22.14 5.42 22.14 8.5C22.14 13.5 12 21 12 21Z" />
                </svg>
                {likeCount > 0 && <span className={`text-sm font-semibold ${liked ? 'text-pink-400' : 'text-gray-200'}`}>{likeCount.toLocaleString()}</span>}
              </motion.button>

              <motion.button whileTap={{ scale: 0.8 }} onClick={() => setCommentModalOpen(true)}
                className="flex items-center gap-1.5 group">
                <svg className="w-6 h-6 fill-none stroke-gray-200 group-hover:stroke-indigo-400 transition"
                  viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {commentCount > 0 && <span className="text-sm font-semibold text-gray-200">{commentCount}</span>}
              </motion.button>
            </div>

            {isOwner && (
              <button onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 rounded-xl px-4 py-2.5 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete post
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Desktop: side-by-side card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="hidden md:flex relative z-10 w-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl mx-6 lg:mx-16"
          style={{ maxWidth: '900px', height: 'min(85vh, 580px)' }}
        >
          {/* Media */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {isVideo ? (
              <>
                <video
                  src={resolveMediaUrl(post.mediaUrl)}
                  controls
                  muted={muted}
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-contain bg-black"
                  style={{ background: '#000' }}
                />
                {/* Video badge */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1.5 pointer-events-none">
                  <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  <span className="text-white text-xs font-semibold tracking-wide">VIDEO</span>
                </div>
                {/* Mute toggle */}
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="absolute bottom-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <img
                src={resolveMediaUrl(post.mediaUrl)}
                alt={post.caption || 'Post'}
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* Right panel */}
          <div className="w-[320px] xl:w-[360px] shrink-0 border-l border-gray-800 flex flex-col">
            {/* Author */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
              <button onClick={() => { onClose(); router.push(`/profile/${post.author.username}`); }} className="shrink-0">
                <Avatar user={post.author} size="sm" />
              </button>
              <div className="flex-1 min-w-0">
                <button onClick={() => { onClose(); router.push(`/profile/${post.author.username}`); }}
                  className="text-white text-sm font-semibold hover:underline leading-tight block truncate">
                  {post.author.username}
                </button>
                <p className="text-gray-500 text-[11px] mt-0.5">{timeAgo(post.createdAt)}</p>
              </div>
            </div>

            {/* Caption */}
            {post.caption && (
              <div className="px-5 py-3.5 shrink-0">
                <p className="text-sm text-gray-200 leading-relaxed">
                  <span className="font-semibold text-white mr-1.5">{post.author.username}</span>
                  {post.caption}
                </p>
              </div>
            )}

            <div className="flex-1" />

            {/* Action bar */}
            <div className="px-5 py-4 border-t border-gray-800 shrink-0 space-y-3">
              {/* Like + comment icons */}
              <div className="flex items-center gap-4">
                <motion.button whileTap={{ scale: 0.8 }} onClick={handleLike} disabled={liking}
                  className="flex items-center gap-1.5 group">
                  <svg className={`w-6 h-6 transition-all duration-150 ${liked ? 'fill-pink-500 stroke-pink-500' : 'fill-none stroke-gray-200 group-hover:stroke-pink-400'}`}
                    viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12.54 3.81 13.07 5.09C13.6 3.81 15.1 3 16.64 3C19.72 3 22.14 5.42 22.14 8.5C22.14 13.5 12 21 12 21Z" />
                  </svg>
                  {likeCount > 0 && (
                    <span className={`text-sm font-semibold ${liked ? 'text-pink-400' : 'text-gray-200'}`}>
                      {likeCount.toLocaleString()}
                    </span>
                  )}
                </motion.button>

                <motion.button whileTap={{ scale: 0.8 }} onClick={() => setCommentModalOpen(true)}
                  className="flex items-center gap-1.5 group">
                  <svg className="w-6 h-6 fill-none stroke-gray-200 group-hover:stroke-indigo-400 transition"
                    viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  {commentCount > 0 && (
                    <span className="text-sm font-semibold text-gray-200">{commentCount}</span>
                  )}
                </motion.button>
              </div>

              {/* Delete */}
              {isOwner && (
                <button onClick={() => setDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 rounded-xl px-4 py-2.5 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete post
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Comment bottom-sheet */}
      <AnimatePresence>
        {commentModalOpen && (
          <CommentModal
            post={post}
            onClose={() => setCommentModalOpen(false)}
            onCountChange={(count) => {
              setCommentCount(count);
              onCommentCountChange?.(post._id, count);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <DeleteConfirmModal
            onConfirm={() => { setDeleteConfirm(false); onDelete(post._id); onClose(); }}
            onCancel={() => setDeleteConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Grid tile ─────────────────────────────────────────────── */
function PostTile({
  post,
  me,
  isOwner,
  onClick,
  onLike,
  commentCountOverride,
}: {
  post: Post;
  me?: User | null;
  isOwner: boolean;
  onClick: () => void;
  onLike?: (updatedPost: Post) => void;
  commentCountOverride?: number;
}) {
  const [commentCount, setCommentCount] = useState(0);
  const displayCommentCount = commentCountOverride ?? commentCount;
  const [likesOverride, setLikesOverride] = useState<string[] | null>(null);
  const [liking, setLiking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = post.mediaType === 'video';

  const prevLikesRef = useRef(post.likes);
  useEffect(() => {
    if (post.likes !== prevLikesRef.current) {
      prevLikesRef.current = post.likes;
      setLikesOverride(null);
    }
  }, [post.likes]);

  const effectiveLikes = likesOverride ?? post.likes ?? [];
  const liked = !!me?._id && effectiveLikes.includes(me._id);
  const likeCount = effectiveLikes.length;

  useEffect(() => {
    let mounted = true;
    api.get(`/comments/${post._id}?page=1&pageSize=1`)
      .then(({ data }) => { if (mounted) setCommentCount(data.total || 0); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [post._id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!me?._id || liking) return;
    setLiking(true);
    const newLikes = liked
      ? effectiveLikes.filter((id) => id !== me._id)
      : [...effectiveLikes, me._id];
    setLikesOverride(newLikes);
    try {
      const { data } = await api.post(`/posts/${post._id}/${liked ? 'unlike' : 'like'}`);
      onLike?.(data.post);
    } catch {
      setLikesOverride(null);
      toast.error('Failed to update like');
    } finally {
      setLiking(false);
    }
  };

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-sm bg-gray-800 cursor-pointer group"
      style={{ aspectRatio: '1 / 1' }}
      onMouseEnter={() => { if (isVideo && videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); } }}
      onMouseLeave={() => { if (isVideo && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } }}
    >
      {/* Media: video or image */}
      {isVideo ? (
        <video
          ref={videoRef}
          src={resolveMediaUrl(post.mediaUrl)}
          muted
          playsInline
          loop
          preload="metadata"
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={resolveMediaUrl(post.mediaUrl)}
          alt={post.caption}
          className="w-full h-full object-cover"
          draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      )}

      {/* Video badge — top-right */}
      {isVideo && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1">
          <svg className="w-3 h-3 text-white fill-white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-5">
        <div className="flex items-center gap-1.5 text-white">
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12.54 3.81 13.07 5.09C13.6 3.81 15.1 3 16.64 3C19.72 3 22.14 5.42 22.14 8.5C22.14 13.5 12 21 12 21Z" />
          </svg>
          <span className="text-sm font-bold">{likeCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-white">
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="text-sm font-bold">{displayCommentCount}</span>
        </div>
      </div>

      {/* Like button bottom-left */}
      <button
        className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full z-10"
        onClick={handleLike}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <svg
          className={`w-3.5 h-3.5 transition-all ${liked ? 'fill-pink-500 stroke-pink-500' : 'fill-none stroke-white/80'}`}
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12.54 3.81 13.07 5.09C13.6 3.81 15.1 3 16.64 3C19.72 3 22.14 5.42 22.14 8.5C22.14 13.5 12 21 12 21Z" />
        </svg>
        <span className={`text-[11px] font-semibold ${liked ? 'text-pink-400' : 'text-white/80'}`}>
          {likeCount}
        </span>
      </button>
    </motion.div>
  );
}

/* ─── Main component ────────────────────────────────────────── */
const PostList = ({ posts, isOwner, onDelete, me, onLike }: PostListProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentCountOverrides, setCommentCountOverrides] = useState<Record<string, number>>({});
  const selectedPost = selectedId ? posts.find((p) => p._id === selectedId) ?? null : null;

  const uniquePosts = Array.from(new Map(posts.map((p) => [p._id, p])).values());

  if (!uniquePosts.length) return null;

  return (
    <>
      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {uniquePosts.map((post) => (
          <PostTile
            key={post._id}
            post={post}
            me={me}
            isOwner={isOwner}
            onClick={() => setSelectedId(post._id)}
            onLike={onLike}
            commentCountOverride={commentCountOverrides[post._id]}
          />
        ))}
      </div>

      {/* Post lightbox */}
      <AnimatePresence>
        {selectedPost && (
          <PostModal
            post={selectedPost}
            isOwner={isOwner}
            me={me}
            onClose={() => setSelectedId(null)}
            onDelete={(id) => { onDelete(id); setSelectedId(null); }}
            onLike={onLike}
            onCommentCountChange={(postId, count) =>
              setCommentCountOverrides((prev) => ({ ...prev, [postId]: count }))
            }
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default PostList;

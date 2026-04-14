'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import CommentSection from './CommentSection';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { Post } from '@/types';

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 604800) return `${Math.floor(d / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PostFeedTile({
  post,
  me,
  onLike,
  onFollow,
  followed,
  followLoading,
  onDelete,
}: {
  post: Post;
  me: any;
  onLike: () => void;
  onFollow: () => void;
  followed: boolean;
  followLoading: boolean;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const isOwn = post.author._id === me?._id;
  const isVideo = post.mediaType === 'video';

  // ── Video autoplay on scroll ─────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaWrapRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!isVideo || !mediaWrapRef.current) return;
    const el = mediaWrapRef.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isVideo]);

  // ── Optimistic like state ────────────────────────────────────
  // Store a local override so the heart flips instantly, then clear
  // it when the parent confirms the update via new post.likes prop.
  const [likesOverride, setLikesOverride] = useState<string[] | null>(null);
  const prevLikesRef = useRef(post.likes);
  useEffect(() => {
    if (post.likes !== prevLikesRef.current) {
      prevLikesRef.current = post.likes;
      setLikesOverride(null); // parent confirmed → drop optimistic state
    }
  }, [post.likes]);

  const effectiveLikes = likesOverride ?? post.likes ?? [];
  const liked = !!me?._id && effectiveLikes.includes(me._id);
  const likeCount = effectiveLikes.length;

  // ── Comments ─────────────────────────────────────────────────
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);

  // Always fetch the real count on mount (backend may not return commentCount yet)
  useEffect(() => {
    api.get(`/comments/${post._id}?page=1&pageSize=1`)
      .then(({ data }) => setCommentCount(data.total ?? 0))
      .catch(() => {});
  }, [post._id]);

  // ── Double-tap heart burst ────────────────────────────────────
  const [heartBurst, setHeartBurst] = useState(false);
  const showBurst = () => {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 900);
  };

  const handleLike = () => {
    if (!me?._id) return;
    const newLikes = liked
      ? effectiveLikes.filter((id) => id !== me._id)
      : [...effectiveLikes, me._id];
    setLikesOverride(newLikes);
    if (!liked) showBurst();
    onLike();
  };

  const handleDoubleTap = () => {
    if (!liked) handleLike();
    else showBurst();
  };

  const focusComments = () => {
    setCommentModalOpen(true);
  };

  const goToProfile = () => router.push(`/profile/${post.author.username}`);

  return (
    <article className="bg-gray-900 border-b border-gray-800/50">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-3">
        <button onClick={goToProfile} className="shrink-0">
          <Avatar user={post.author} size="sm" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={goToProfile}
              className="text-white font-semibold text-sm hover:underline leading-tight"
            >
              {post.author.username}
            </button>
            {!isOwn && !followed && (
              <>
                <span className="text-gray-600 text-xs select-none">•</span>
                <button
                  onClick={onFollow}
                  disabled={followLoading}
                  className="text-indigo-400 text-sm font-semibold hover:text-indigo-300 transition disabled:opacity-50 leading-tight"
                >
                  {followLoading ? 'Following…' : 'Follow'}
                </button>
              </>
            )}
          </div>
          <p className="text-gray-500 text-[11px] leading-tight mt-0.5">
            {timeAgo(post.createdAt)}
          </p>
        </div>

        {/* Three-dot / delete for own posts */}
        {isOwn && onDelete && (
          <button
            onClick={onDelete}
            className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
            title="Delete post"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="4" cy="10" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="16" cy="10" r="1.5" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Media (Image/Video) ─────────────────────────────── */}
      <div
        ref={mediaWrapRef}
        className="relative w-full bg-black select-none cursor-pointer"
        onDoubleClick={handleDoubleTap}
      >
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={post.mediaUrl}
              muted={muted}
              loop
              playsInline
              className="w-full object-contain max-h-[580px] bg-black"
              style={{ background: '#000' }}
            />
            {/* Video badge — top-left */}
            <div className="absolute top-2.5 left-2.5 z-10 bg-black/50 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1 pointer-events-none">
              <svg className="w-3 h-3 fill-white" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-white text-[10px] font-semibold tracking-wide">VIDEO</span>
            </div>
            {/* Mute/unmute toggle — bottom-right */}
            <button
              onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
              className="absolute bottom-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </>
        ) : (
          <img
            src={post.mediaUrl}
            alt={post.caption || 'Post'}
            className="w-full object-contain max-h-[580px]"
            draggable={false}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* Double-tap heart burst */}
        <AnimatePresence>
          {heartBurst && (
            <motion.div
              key="burst"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.15, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <svg className="w-24 h-24 drop-shadow-2xl" viewBox="0 0 24 24" fill="#ec4899">
                <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12.54 3.81 13.07 5.09C13.6 3.81 15.1 3 16.64 3C19.72 3 22.14 5.42 22.14 8.5C22.14 13.5 12 21 12 21Z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Action bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">

        {/* Like button + count */}
        <motion.button
          onClick={handleLike}
          whileTap={{ scale: 0.82 }}
          aria-label={liked ? 'Unlike' : 'Like'}
          className="flex items-center gap-1.5 group"
        >
          <svg
            className={`w-[22px] h-[22px] transition-all duration-150 ${
              liked
                ? 'fill-pink-500 stroke-pink-500 drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]'
                : 'fill-none stroke-gray-300 group-hover:stroke-pink-400'
            }`}
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12.54 3.81 13.07 5.09C13.6 3.81 15.1 3 16.64 3C19.72 3 22.14 5.42 22.14 8.5C22.14 13.5 12 21 12 21Z" />
          </svg>
          <AnimatePresence mode="popLayout">
            {likeCount > 0 && (
              <motion.span
                key={likeCount}
                initial={{ opacity: 0, y: -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.8 }}
                transition={{ duration: 0.18 }}
                className={`text-sm font-semibold tabular-nums leading-none ${
                  liked ? 'text-pink-400' : 'text-gray-300 group-hover:text-pink-400'
                } transition-colors`}
              >
                {likeCount.toLocaleString()}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Comment button + count */}
        <motion.button
          onClick={focusComments}
          whileTap={{ scale: 0.82 }}
          aria-label="Comment"
          className="flex items-center gap-1.5 group"
        >
          <svg
            className="w-[22px] h-[22px] fill-none stroke-gray-300 group-hover:stroke-indigo-400 transition-colors"
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <AnimatePresence mode="popLayout">
            {commentCount > 0 && (
              <motion.span
                key={commentCount}
                initial={{ opacity: 0, y: -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.8 }}
                transition={{ duration: 0.18 }}
                className="text-sm font-medium tabular-nums leading-none text-gray-400 group-hover:text-indigo-400 transition-colors"
              >
                {commentCount.toLocaleString()}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <div className="flex-1" />
      </div>

      {/* ── Caption ───────────────────────────────────────────── */}
      {post.caption && (
        <div className="px-3 pb-1.5">
          <p className="text-sm leading-relaxed text-gray-200">
            <button
              onClick={goToProfile}
              className="font-semibold text-white hover:underline mr-1.5"
            >
              {post.author.username}
            </button>
            {post.caption}
          </p>
        </div>
      )}


      {/* ── Comment Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {commentModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setCommentModalOpen(false)}
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
              {/* Modal header */}
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
                  onClick={() => setCommentModalOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable comment body */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <CommentSection
                  postId={post._id}
                  autoFocus
                  onCountChange={setCommentCount}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

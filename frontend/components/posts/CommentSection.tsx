'use client';
import React, { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { User } from '@/types';

export interface Comment {
  _id: string;
  author: Pick<User, '_id' | 'username' | 'avatar'>;
  content: string;
  createdAt: string;
}

interface CommentSectionProps {
  postId: string;
  /** Auto-focus the comment input when the section mounts */
  autoFocus?: boolean;
  /** Fires whenever the total comment count changes */
  onCountChange?: (count: number) => void;
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 604800) return `${Math.floor(d / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommentSection({ postId, autoFocus = false, onCountChange }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchComments(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    if (autoFocus) {
      // Small delay so the section has mounted and is visible
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const fetchComments = async (p = 1, replace = false) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/comments/${postId}?page=${p}&pageSize=10`);
      setComments((prev) => (replace ? data.comments : [...prev, ...data.comments]));
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
      setPage(data.page ?? p);
      onCountChange?.(data.total ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/comments/${postId}`, { content: text });
      setComments((prev) => [data.comment, ...prev]);
      setTotal((n) => n + 1);
      onCountChange?.(total + 1);
      setNewComment('');
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Comment list */}
      <div className="max-h-52 overflow-y-auto flex flex-col gap-3 pr-1">
        {comments.length === 0 && !loading && (
          <p className="text-gray-600 text-xs text-center py-2">No comments yet. Be the first!</p>
        )}

        {comments.map((c) => (
          <div key={c._id} className="flex items-start gap-2.5">
            {c.author.avatar ? (
              <img
                src={c.author.avatar}
                alt={c.author.username}
                className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                {c.author.username[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 leading-snug">
                <span className="font-semibold text-white mr-1.5">{c.author.username}</span>
                <span className="text-gray-300">{c.content}</span>
              </p>
              <span className="text-gray-600 text-[10px]">{timeAgo(c.createdAt)}</span>
            </div>
          </div>
        ))}

        {hasMore && (
          <button
            onClick={() => fetchComments(page + 1)}
            disabled={loading}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium self-start disabled:opacity-50"
          >
            {loading ? 'Loading…' : `View ${total - comments.length} more`}
          </button>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-800/60 pt-2.5">
        <input
          ref={inputRef}
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          disabled={submitting}
          className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none disabled:opacity-50"
        />
        {newComment.trim() && (
          <button
            type="submit"
            disabled={submitting}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold shrink-0 disabled:opacity-50 transition"
          >
            {submitting ? '…' : 'Post'}
          </button>
        )}
      </form>
    </div>
  );
}

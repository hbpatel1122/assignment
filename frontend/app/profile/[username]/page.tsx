'use client';
import { use, useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
const PostForm = dynamic(() => import('@/components/posts/PostForm'), { ssr: false });
const PostList = dynamic(() => import('@/components/posts/PostList'), { ssr: false });

// Helper for scroll pagination
function useInfiniteScroll(callback: () => void, hasMore: boolean, loading: boolean) {
  useEffect(() => {
    if (!hasMore || loading) return;
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 300 &&
        !loading && hasMore
      ) {
        callback();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [callback, hasMore, loading]);
}
// ...existing code...

// Simple modal placeholder for creating a post
// ...existing code...

function CreatePostModal({ open, onClose, onPostCreated }: { open: boolean; onClose: () => void; onPostCreated: (post: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const handleSubmit = async (data: { caption: string; file: File | null }) => {
    setLoading(true);
    setError(null);
    try {
      let mediaUrl = '';
      let mediaType = '';
      if (data.file) {
        const form = new FormData();
        form.append('media', data.file);
        const uploadRes = await api.post('/upload/media', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrl = uploadRes.data.url;
        mediaType = uploadRes.data.type;
      }
      const postRes = await api.post('/posts', {
        mediaUrl,
        mediaType,
        caption: data.caption,
      });
      onPostCreated(postRes.data.post);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Create Post</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && <div className="mb-2 text-red-400 text-sm">{error}</div>}
        <PostForm onSubmit={handleSubmit} onCancel={onClose} loading={loading} />
      </div>
    </div>
  );
}
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import Loader from '@/components/ui/Loader';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useStore } from '@/store';
import { Post, User } from '@/types';
import { formatLastSeen } from '@/lib/dateUtils';

interface ProfileData {
  user: User;
  isOwner: boolean;
  isFollowing: boolean;
  hasRequested: boolean;
}

type Tab = 'followers' | 'following' | 'requests';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const router = useRouter();
  const { user: me, updateUser, onlineUsers } = useStore();

  // --- Post list state ---
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 5;

  // Fetch posts for profile
  const fetchPosts = useCallback(async () => {
    if (postsLoading || !username || !hasMore) return;
    setPostsLoading(true);
    setPostsError(null);
    try {
      const { data } = await api.get(`/posts/user/${username}?page=${page}&pageSize=${pageSize}`);
      if (Array.isArray(data.posts)) {
        setPosts((prev) => [...prev, ...data.posts]);
        setHasMore(data.hasMore ?? data.posts.length === pageSize);
        setPage((p) => p + 1);
      } else {
        setHasMore(false);
      }
    } catch (err: any) {
      setPostsError('Failed to load posts');
      setHasMore(false);
    } finally {
      setPostsLoading(false);
    }
  }, [username, page, postsLoading, hasMore]);

  // Reset posts when username changes
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
  }, [username]);

  // Fetch first page on mount/username change
  useEffect(() => {
    if (!username) return;
    fetchPosts();
    // eslint-disable-next-line
  }, [username]);

  // Infinite scroll
  useInfiniteScroll(fetchPosts, hasMore, postsLoading);

  // Delete post handler
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  // Like / unlike post handler — receives the updated post returned by API
  const handleLikePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => p._id === updatedPost._id ? updatedPost : p));
  };

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [bio, setBio] = useState('');
  const [profileType, setProfileType] = useState<'public' | 'private'>('public');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/users/${username}`);
      setData(d);
      setBio(d.user.bio || '');
      setProfileType(d.user.profileType);
      // Keep sidebar badge in sync with real followRequests count
      if (d.isOwner) {
        updateUser({ followRequests: d.user.followRequests });
      }
    } catch {
      toast.error('User not found');
      router.push('/messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [username]);

  // Listen for real-time follow-request acceptance so the requester's UI updates instantly
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ acceptedBy }: { acceptedBy: string }) => {
      // If we are viewing the profile of the person who just accepted our request
      if (data && acceptedBy === data.user._id) {
        setData((d) => d ? { ...d, isFollowing: true, hasRequested: false } : d);
        toast.success(`${data.user.username} accepted your follow request`);
      }
    };
    socket.on('followRequestAccepted', handler);
    return () => { socket.off('followRequestAccepted', handler); };
  }, [data?.user._id]);

  const handleFollow = async () => {
    if (!data) return;
    setFollowLoading(true);
    try {
      if (data.isFollowing || data.hasRequested) {
        const wasRequested = data.hasRequested;
        await api.post(`/users/${data.user._id}/unfollow`);
        setData((d) => {
          if (!d) return d;
          const newFollowers = (d.user.followers as User[]).filter(f => f._id !== me?._id);
          return { ...d, isFollowing: false, hasRequested: false, user: { ...d.user, followers: newFollowers } };
        });
        toast.success(wasRequested ? 'Request cancelled' : `Unfollowed ${data.user.username}`);
      } else {
        const { data: res } = await api.post(`/users/${data.user._id}/follow`);
        if (res.status === 'following') {
          setData((d) => {
            if (!d) return d;
            const meAsUser = me as User;
            const newFollowers = [...(d.user.followers as User[]), meAsUser];
            return { ...d, isFollowing: true, hasRequested: false, user: { ...d.user, followers: newFollowers } };
          });
        } else {
          setData((d) => d ? { ...d, isFollowing: false, hasRequested: true } : d);
        }
        toast.success(res.status === 'requested'
          ? `Follow request sent to ${data.user.username}`
          : `Now following ${data.user.username}`);
      }
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const id = toast.loading('Saving profile…');
    try {
      // Upload avatar first if a new one was selected
      if (avatarFile) {
        setUploadingAvatar(true);
        const form = new FormData();
        form.append('avatar', avatarFile);
        await api.post('/users/avatar', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadingAvatar(false);
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      const { data: res } = await api.put('/users/profile/update', { bio, profileType });
      updateUser(res.user);
      // Re-fetch full profile so avatar URL is fresh
      const { data: fresh } = await api.get(`/users/${username}`);
      updateUser(fresh.user);
      setData(fresh);
      setBio(fresh.user.bio || '');
      setProfileType(fresh.user.profileType);
      setEditMode(false);
      toast.success('Profile updated!', { id });
    } catch {
      toast.error('Failed to save profile', { id });
      setUploadingAvatar(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (userId: string) => {
    try {
      await api.post(`/users/requests/${userId}/accept`);
      toast.success('Follow request accepted');
      setData((d) => {
        if (!d) return d;
        const accepted = (d.user.followRequests as unknown as User[]).find(u => u._id === userId);
        const newRequests = (d.user.followRequests as unknown as User[]).filter(u => u._id !== userId);
        // Sync sidebar badge
        updateUser({ followRequests: newRequests.map(u => u._id) });
        return {
          ...d,
          user: {
            ...d.user,
            followRequests: newRequests,
            followers: accepted ? [...(d.user.followers as User[]), accepted] : d.user.followers,
          },
        };
      });
    } catch { toast.error('Failed to accept request'); }
  };

  const handleReject = async (userId: string) => {
    try {
      await api.post(`/users/requests/${userId}/reject`);
      toast.success('Follow request declined');
      setData((d) => {
        if (!d) return d;
        const newRequests = (d.user.followRequests as unknown as User[]).filter(u => u._id !== userId);
        // Sync sidebar badge
        updateUser({ followRequests: newRequests.map(u => u._id) });
        return {
          ...d,
          user: {
            ...d.user,
            followRequests: newRequests,
          },
        };
      });
    } catch { toast.error('Failed to decline request'); }
  };

  const handleRemoveFollower = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/remove-follower`);
      toast.success('Follower removed');
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          user: {
            ...d.user,
            followers: (d.user.followers as User[]).filter(u => u._id !== userId),
          },
        };
      });
    } catch { toast.error('Failed to remove follower'); }
  };

  const handleUnfollowFromList = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/unfollow`);
      toast.success('Unfollowed');
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          user: {
            ...d.user,
            following: (d.user.following as User[]).filter(u => u._id !== userId),
          },
        };
      });
    } catch { toast.error('Failed to unfollow'); }
  };

  const startChat = async (userId: string) => {
    const id = toast.loading('Opening conversation…');
    try {
      const { data: res } = await api.post('/conversations', { userId });
      toast.success('Conversation ready!', { id });
      router.push(`/messages/${res.conversation._id}`);
    } catch {
      toast.error('Could not open conversation', { id });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <Loader size="lg" color="bg-indigo-500" />
        </div>
      </AppShell>
    );
  }

  if (!data) return null;

  const { user: profile, isOwner, isFollowing, hasRequested } = data;
  const isPrivateAndNotFollowing = profile.profileType === 'private' && !isOwner && !isFollowing;

  const followers = profile.followers as User[];
  const following = profile.following as User[];
  const requests = profile.followRequests as unknown as User[];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* ── Profile Details End ── */}

        {/* ── Post List Section ── */}
       

        {/* ── Follow Request Banner (owner only, shown when requests exist) ── */}
        <AnimatePresence>
          {isOwner && requests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <button
                onClick={() => { setEditMode(false); setActiveTab(activeTab === 'requests' ? null : 'requests'); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/30 rounded-2xl transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-yellow-300 font-semibold text-sm">
                    {requests.length} Follow {requests.length === 1 ? 'Request' : 'Requests'} Pending
                  </p>
                  <p className="text-yellow-500/70 text-xs mt-0.5">Tap to review and manage</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-yellow-500 text-black text-xs font-bold rounded-full animate-pulse">
                    {requests.length}
                  </span>
                  <svg className={`w-4 h-4 text-yellow-500 transition-transform ${activeTab === 'requests' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Profile Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-4"
        >
          {/* Banner */}
          <div className="h-32 bg-gradient-to-br from-indigo-900/60 via-violet-900/50 to-gray-900 relative">
            {/* Privacy badge on banner */}
            <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 ${
              profile.profileType === 'private'
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}>
              {profile.profileType === 'private' ? (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Private
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                  Public
                </>
              )}
            </span>
          </div>

          <div className="px-5 sm:px-6 pb-6">
            {/* Avatar + Action buttons row */}
            <div className="flex items-end justify-between -mt-12 mb-5">
              <div className="relative group">
                <div className="ring-4 ring-gray-900 rounded-full">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="preview"
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-800"
                    />
                  ) : (
                    <Avatar user={{ ...profile, isOnline: isOwner || profile.isOnline || onlineUsers.has(profile._id) }} size="xl" />
                  )}
                </div>
                {/* Upload button — only visible in edit mode */}
                {isOwner && editMode && (
                  <>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Change photo"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    {avatarPreview && (
                      <button
                        onClick={() => { setAvatarPreview(null); setAvatarFile(null); }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mt-12 flex-wrap justify-end">
                {isOwner ? (
                  <>
                    <button
                      onClick={() => setPostModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-indigo-600 bg-indigo-700 hover:bg-indigo-600 text-white font-medium transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Post
                    </button>
                    <button
                      onClick={() => { setEditMode(!editMode); setActiveTab(null); setAvatarPreview(null); setAvatarFile(null); }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl border font-medium transition ${
                        editMode
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-white'
                      }`}
                    >
                      {editMode ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancel
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Profile
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startChat(profile._id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Message
                    </button>
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition font-medium ${
                        isFollowing
                          ? 'bg-gray-800 text-white border border-gray-700 hover:border-red-500 hover:text-red-400'
                          : hasRequested
                          ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {followLoading ? (
                        <Loader size="sm" />
                      ) : isFollowing ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Following
                        </>
                      ) : hasRequested ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Requested
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Follow
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Name & status */}
            <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-white">{profile.username}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  (isOwner || profile.isOnline || onlineUsers.has(profile._id))
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                }`}>
                  {(isOwner || profile.isOnline || onlineUsers.has(profile._id)) ? 'Online' : `Seen ${formatLastSeen(profile.lastSeen)}`}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{profile.email}</p>
              {!editMode && profile.bio && (
                <p className="text-gray-300 text-sm mt-2 leading-relaxed">{profile.bio}</p>
              )}
            </div>

            {/* Edit form */}
            <AnimatePresence>
              {editMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 space-y-4 overflow-hidden"
                >
                  <div className="h-px bg-gray-800" />

                  {/* Bio */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={160}
                      rows={3}
                      placeholder="Tell people about yourself..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition"
                    />
                    <p className="text-gray-600 text-xs text-right mt-1">{bio.length}/160</p>
                  </div>

                  {/* Privacy toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Privacy</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setProfileType('public')}
                        className={`py-3 px-4 rounded-xl border text-sm font-medium transition flex items-center justify-center gap-2 ${
                          profileType === 'public'
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                        </svg>
                        Public
                      </button>
                      <button
                        onClick={() => setProfileType('private')}
                        className={`py-3 px-4 rounded-xl border text-sm font-medium transition flex items-center justify-center gap-2 ${
                          profileType === 'private'
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Private
                      </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {profileType === 'private'
                        ? 'Only approved followers can see your content.'
                        : 'Anyone can follow you and view your profile.'}
                    </p>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                  >
                    {uploadingAvatar ? (
                      <><Loader size="sm" /> Uploading avatar…</>
                    ) : saving ? (
                      <><Loader size="sm" /> Saving…</>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats row */}
            <div className="flex gap-4 sm:gap-8 pt-2 border-t border-gray-800">
              <button
                onClick={() => !editMode && setActiveTab(activeTab === 'followers' ? null : 'followers')}
                className="text-center hover:text-indigo-400 transition group"
              >
                <p className="text-white font-bold text-xl group-hover:text-indigo-400">{followers.length}</p>
                <p className="text-gray-500 text-xs mt-0.5">Followers</p>
              </button>
              <button
                onClick={() => !editMode && setActiveTab(activeTab === 'following' ? null : 'following')}
                className="text-center hover:text-indigo-400 transition group"
              >
                <p className="text-white font-bold text-xl group-hover:text-indigo-400">{following.length}</p>
                <p className="text-gray-500 text-xs mt-0.5">Following</p>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Followers / Following / Requests Modal ── */}
        <AnimatePresence>
          {activeTab && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setActiveTab(null)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

              {/* Modal panel */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800 shrink-0">
                  <h3 className="text-white font-semibold capitalize text-base">{activeTab}</h3>
                  <button
                    onClick={() => setActiveTab(null)}
                    className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* List */}
                <ul className="divide-y divide-gray-800 overflow-y-auto flex-1">
                  {(activeTab === 'followers' ? followers :
                    activeTab === 'following' ? following :
                    requests
                  ).map((u) => (
                    <li key={u._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition">
                      <Avatar user={{ ...u, isOnline: u.isOnline || onlineUsers.has(u._id) }} size="md" />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => { setActiveTab(null); router.push(`/profile/${u.username}`); }}
                          className="text-white font-medium text-sm hover:text-indigo-400 transition block truncate"
                        >
                          {u.username}
                        </button>
                        {u.bio && (
                          <p className="text-gray-500 text-xs truncate mt-0.5">{u.bio}</p>
                        )}
                        <p className="text-gray-600 text-xs mt-0.5">
                          {(u.isOnline || onlineUsers.has(u._id)) ? (
                            <span className="text-emerald-500">Online</span>
                          ) : (
                            <span>{u.profileType === 'private' ? 'Private' : 'Public'}</span>
                          )}
                        </p>
                      </div>

                      {/* Action buttons per tab */}
                      {activeTab === 'requests' && isOwner && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleAccept(u._id)}
                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(u._id)}
                            className="px-3 py-1.5 text-xs font-semibold bg-gray-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-lg border border-gray-700 hover:border-red-500/30 transition"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {activeTab === 'followers' && isOwner && (
                        <button
                          onClick={() => handleRemoveFollower(u._id)}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-gray-800 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg border border-gray-700 hover:border-red-500/30 transition"
                        >
                          Remove
                        </button>
                      )}

                      {activeTab === 'following' && isOwner && (
                        <button
                          onClick={() => handleUnfollowFromList(u._id)}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-gray-800 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg border border-gray-700 hover:border-red-500/30 transition"
                        >
                          Unfollow
                        </button>
                      )}
                    </li>
                  ))}
                  {(activeTab === 'followers' ? followers :
                    activeTab === 'following' ? following :
                    requests).length === 0 && (
                    <li className="px-4 py-10 text-center text-gray-500 text-sm">
                      No {activeTab} yet
                    </li>
                  )}
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Private profile gate ── */}
        {isPrivateAndNotFollowing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center"
          >
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              
            </div>
            <p className="text-white font-semibold text-lg mb-1">This account is private</p>
            <p className="text-gray-400 text-sm">
              Follow {profile.username} to see their posts and media.
            </p>
            {hasRequested && (
              <p className="text-yellow-400 text-sm mt-3 font-medium">
                Follow request sent — waiting for approval
              </p>
            )}
          </motion.div>
        )}

         {!isPrivateAndNotFollowing && (
          <section className="mb-10 mt-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <h2 className="text-xl font-bold text-white">Posts</h2>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              {/* Remove duplicate posts by _id before passing to PostList */}
              <PostList
                posts={Array.from(new Map(posts.map(post => [post._id, post])).values()) as Post[]}
                isOwner={isOwner}
                onDelete={handleDeletePost}
                me={me}
                onLike={handleLikePost}
              />
              {postsLoading && (
                <div className="text-gray-400 text-center py-4 flex flex-col items-center gap-2">
                  <Loader size="sm" />
                  <span>Loading more posts…</span>
                </div>
              )}
              {!postsLoading && posts.length === 0 && (
                <div className="text-gray-500 text-center py-8">
                  <svg className="w-10 h-10 mx-auto mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <div className="font-semibold">No posts yet</div>
                  <div className="text-gray-400 text-sm">{isOwner ? "You haven't posted anything yet. Start sharing your moments!" : `${profile.username} hasn't posted anything yet.`}</div>
                </div>
              )}
              {!hasMore && !postsLoading && posts.length > 0 && (
                <div className="text-gray-500 text-center py-4">
                  <svg className="w-6 h-6 mx-auto mb-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span className="block">You’ve reached the end of the posts.</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      {/* Add Post Modal */}
      <CreatePostModal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onPostCreated={(post) => setPosts((prev) => [post, ...prev])}
      />
    </AppShell>
  );
}

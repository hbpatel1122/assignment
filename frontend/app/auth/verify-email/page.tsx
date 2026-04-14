'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ChatSphereLogo from '@/components/ui/ChatSphereLogo';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useStore } from '@/store';
import { validateOtp } from '@/lib/validation';
import Loader from '@/components/ui/Loader';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, token, setAuth, updateUser, _hasHydrated } = useStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Wait for hydration, then redirect if already verified or not logged in
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user || !token) {
      router.replace('/auth');
      return;
    }
    if (user.isEmailVerified) {
      router.replace('/messages');
      return;
    }
    // Fetch fresh user from server — store may be stale
    api.get('/auth/me').then(({ data }) => {
      if (data.user?.isEmailVerified) {
        updateUser({ isEmailVerified: true });
        router.replace('/messages');
      }
    }).catch(() => {/* ignore */});
  }, [_hasHydrated, user?.isEmailVerified, token]);

  // Countdown for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const next = paste.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(next);
    inputRefs.current[Math.min(paste.length, 5)]?.focus();
  };

  const apiError = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong';

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    const err = validateOtp(code);
    if (err) { toast.error(err); return; }

    setLoading(true);
    const id = toast.loading('Verifying OTP…');
    try {
      const { data } = await api.post('/auth/verify-email', { otp: code });
      // Save both the updated user (isEmailVerified: true) and the fresh token
      setAuth(data.user, data.token);
      toast.success('Email verified! Welcome aboard 🎉', { id });
      router.replace('/messages');
    } catch (err: unknown) {
      const msg = apiError(err);
      // Email was already verified (e.g. duplicate submit) — just redirect
      if (msg.toLowerCase().includes('already verified')) {
        updateUser({ isEmailVerified: true });
        toast.success('Email verified! Redirecting…', { id });
        router.replace('/messages');
        return;
      }
      toast.error(msg, { id });
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    const id = toast.loading('Resending OTP…');
    try {
      await api.post('/auth/resend-otp');
      setCountdown(30);
      toast.success('OTP resent! (use 123456)', { id });
    } catch (err: unknown) {
      toast.error(apiError(err), { id });
    } finally {
      setResending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <motion.div
        className="absolute top-[-15%] right-[-10%] w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[-10%] w-80 h-80 bg-violet-600/15 rounded-full blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo + icon */}
          <div className="flex flex-col items-center mb-8">
            <ChatSphereLogo size={56} className="mb-4" />
            <div className="w-16 h-16 bg-indigo-600/20 border-2 border-indigo-500/40 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Verify your email</h1>
            <p className="text-gray-400 text-sm mt-2 text-center">
              We sent a 6-digit code to<br />
              <span className="text-indigo-400 font-medium">{user.email}</span>
            </p>
          </div>

          {/* OTP inputs */}
          <form onSubmit={handleVerify}>
            <div className="flex gap-2 justify-center mb-2" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-gray-800 text-white transition-all duration-150 focus:outline-none ${
                    digit
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-gray-700 focus:border-indigo-500'
                  }`}
                />
              ))}
            </div>

            {/* Demo hint */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-1.5 text-indigo-300 text-xs text-center">
                💡 Demo OTP: <span className="font-mono font-bold tracking-widest">123456</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length < 6}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader size="sm" /> : 'Verify email'}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-5 text-center">
            <p className="text-gray-500 text-sm">
              Didn&apos;t receive the code?{' '}
              <button
                onClick={handleResend}
                disabled={countdown > 0 || resending}
                className="text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:cursor-not-allowed transition font-medium"
              >
                {resending ? 'Sending…' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </button>
            </p>
          </div>

          {/* Sign out link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                useStore.getState().logout();
                router.push('/auth');
              }}
              className="text-gray-600 hover:text-gray-400 text-xs transition"
            >
              Sign out and use a different account
            </button>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {['Create account', 'Verify email', 'Start chatting'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                i === 0 ? 'bg-emerald-500 text-white' :
                i === 1 ? 'bg-indigo-600 text-white' :
                'bg-gray-800 text-gray-500'
              }`}>
                {i === 0 ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === 1 ? 'text-white font-medium' : 'text-gray-600'}`}>
                {label}
              </span>
              {i < 2 && <div className="w-4 h-px bg-gray-800" />}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useStore } from '@/store';
import Loader from '@/components/ui/Loader';
import ChatSphereLogo from '@/components/ui/ChatSphereLogo';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateOtp,
  firstError,
} from '@/lib/validation';

type Mode = 'login' | 'signup' | 'forgot-email' | 'forgot-otp' | 'forgot-reset';

export default function AuthPage() {
  const router  = useRouter();
  const setAuth = useStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>('login');

  // shared fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  // field-level errors
  const [emailErr, setEmailErr]   = useState('');
  const [pwdErr,   setPwdErr]     = useState('');
  const [userErr,  setUserErr]    = useState('');

  // signup
  const [username, setUsername] = useState('');

  // forgot
  const [otp,        setOtp]        = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [newPwdErr,  setNewPwdErr]  = useState('');

  const go = (m: Mode) => {
    setMode(m);
    setEmailErr(''); setPwdErr(''); setUserErr(''); setNewPwdErr('');
  };

  /* ── helpers ──────────────────────────────────────────────── */
  const apiError = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong';

  /* ── LOGIN ──────────────────────────────────────────────── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailErr(eErr ?? '');
    setPwdErr(pErr ?? '');
    if (eErr || pErr) return;

    setLoading(true);
    const id = toast.loading('Signing you in…');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.token);
      toast.success(`Welcome back, ${data.user.username}!`, { id });
      router.push(data.user.isEmailVerified ? '/messages' : '/auth/verify-email');
    } catch (err) {
      toast.error(apiError(err), { id });
    } finally { setLoading(false); }
  };

  /* ── SIGNUP ─────────────────────────────────────────────── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const uErr = validateUsername(username);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setUserErr(uErr ?? '');
    setEmailErr(eErr ?? '');
    setPwdErr(pErr ?? '');
    if (firstError(uErr, eErr, pErr)) return;

    setLoading(true);
    const id = toast.loading('Creating your account…');
    try {
      const { data } = await api.post('/auth/signup', { username, email, password });
      setAuth(data.user, data.token);
      toast.success('Account created! Verify your email.', { id });
      router.push('/auth/verify-email');
    } catch (err) {
      toast.error(apiError(err), { id });
    } finally { setLoading(false); }
  };

  /* ── FORGOT — send OTP ──────────────────────────────────── */
  const handleForgotSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailErr(eErr ?? '');
    if (eErr) return;

    setLoading(true);
    const id = toast.loading('Sending OTP…');
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('OTP sent! Check your email.', { id });
      go('forgot-otp');
    } catch (err) {
      toast.error(apiError(err), { id });
    } finally { setLoading(false); }
  };

  /* ── FORGOT — verify OTP ────────────────────────────────── */
  const handleForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const oErr = validateOtp(otp);
    if (oErr) { toast.error(oErr); return; }

    setLoading(true);
    const id = toast.loading('Verifying OTP…');
    try {
      const { data } = await api.post('/auth/verify-reset-otp', { email, otp });
      setResetToken(data.resetToken);
      toast.success('OTP verified!', { id });
      go('forgot-reset');
    } catch (err) {
      toast.error(apiError(err), { id });
    } finally { setLoading(false); }
  };

  /* ── FORGOT — reset password ────────────────────────────── */
  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const pErr = validatePassword(newPwd);
    setNewPwdErr(pErr ?? '');
    if (pErr) return;

    setLoading(true);
    const id = toast.loading('Resetting password…');
    try {
      const { data } = await api.post('/auth/reset-password', { resetToken, newPassword: newPwd });
      setAuth(data.user, data.token);
      toast.success('Password reset! You are now signed in.', { id });
      router.push(data.user.isEmailVerified ? '/messages' : '/auth/verify-email');
    } catch (err) {
      toast.error(apiError(err), { id });
    } finally { setLoading(false); }
  };

  const isForgot = mode.startsWith('forgot');

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <ChatSphereLogo size={64} className="mb-3 shadow-lg drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
          <h1 className="text-2xl font-bold text-white tracking-tight">ChatSphere</h1>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-7"
        >
          <AnimatePresence mode="wait">

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <motion.div key="login" {...fade}>
                <h2 className="text-lg font-semibold text-white mb-5">Sign in</h2>
                <form onSubmit={handleLogin} noValidate className="space-y-3">

                  <FieldWrap error={emailErr}>
                    <input
                      type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                      onBlur={() => setEmailErr(validateEmail(email) ?? '')}
                      placeholder="Email address" autoComplete="email" autoFocus
                      suppressHydrationWarning
                      className={inp(!!emailErr)}
                    />
                  </FieldWrap>

                  <FieldWrap error={pwdErr}>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'} value={password}
                        onChange={e => { setPassword(e.target.value); setPwdErr(''); }}
                        onBlur={() => setPwdErr(validatePassword(password) ?? '')}
                        placeholder="Password" autoComplete="current-password"
                        className={inp(!!pwdErr) + ' pr-10'}
                      />
                      <EyeBtn show={showPwd} toggle={() => setShowPwd(p => !p)} />
                    </div>
                  </FieldWrap>

                  <div className="flex justify-end -mt-1">
                    <button type="button"
                      onClick={() => { go('forgot-email'); setEmailErr(''); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition">
                      Forgot password?
                    </button>
                  </div>

                  <Btn loading={loading} label="Sign in" />
                </form>
              </motion.div>
            )}

            {/* ── SIGNUP ── */}
            {mode === 'signup' && (
              <motion.div key="signup" {...fade}>
                <h2 className="text-lg font-semibold text-white mb-5">Create account</h2>
                <form onSubmit={handleSignup} noValidate className="space-y-3">

                  <FieldWrap error={userErr}>
                    <input
                      type="text" value={username}
                      onChange={e => { setUsername(e.target.value); setUserErr(''); }}
                      onBlur={() => setUserErr(validateUsername(username) ?? '')}
                      placeholder="Username" autoComplete="username" autoFocus
                      suppressHydrationWarning
                      className={inp(!!userErr)}
                    />
                  </FieldWrap>

                  <FieldWrap error={emailErr}>
                    <input
                      type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                      onBlur={() => setEmailErr(validateEmail(email) ?? '')}
                      placeholder="Email address" autoComplete="email"
                      className={inp(!!emailErr)}
                    />
                  </FieldWrap>

                  <FieldWrap error={pwdErr} hint="Min 6 characters">
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'} value={password}
                        onChange={e => { setPassword(e.target.value); setPwdErr(''); }}
                        onBlur={() => setPwdErr(validatePassword(password) ?? '')}
                        placeholder="Password" autoComplete="new-password"
                        className={inp(!!pwdErr) + ' pr-10'}
                      />
                      <EyeBtn show={showPwd} toggle={() => setShowPwd(p => !p)} />
                    </div>
                  </FieldWrap>

                  <Btn loading={loading} label="Create account" />
                </form>
              </motion.div>
            )}

            {/* ── FORGOT — email ── */}
            {mode === 'forgot-email' && (
              <motion.div key="f-email" {...fade}>
                <button onClick={() => go('login')}
                  className="flex items-center gap-1 text-gray-500 hover:text-white text-xs mb-4 transition">
                  ← Back to sign in
                </button>
                <h2 className="text-lg font-semibold text-white mb-1">Forgot password?</h2>
                <p className="text-gray-500 text-xs mb-5">We'll send a 6-digit OTP to your email.</p>
                <form onSubmit={handleForgotSend} noValidate className="space-y-3">
                  <FieldWrap error={emailErr}>
                    <input
                      type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                      onBlur={() => setEmailErr(validateEmail(email) ?? '')}
                      placeholder="Email address" autoFocus
                      suppressHydrationWarning
                      className={inp(!!emailErr)}
                    />
                  </FieldWrap>
                  <Btn loading={loading} label="Send OTP" />
                </form>
              </motion.div>
            )}

            {/* ── FORGOT — OTP ── */}
            {mode === 'forgot-otp' && (
              <motion.div key="f-otp" {...fade}>
                <button onClick={() => go('forgot-email')}
                  className="flex items-center gap-1 text-gray-500 hover:text-white text-xs mb-4 transition">
                  ← Back
                </button>
                <h2 className="text-lg font-semibold text-white mb-1">Enter OTP</h2>
                <p className="text-gray-500 text-xs mb-4">
                  Sent to <span className="text-indigo-400">{email}</span>
                </p>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-indigo-300 text-xs mb-4">
                  💡 Demo OTP: <span className="font-mono font-bold tracking-widest">123456</span>
                </div>
                <form onSubmit={handleForgotOtp} noValidate className="space-y-3">
                  <input
                    type="text" inputMode="numeric" value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456" maxLength={6} autoFocus
                    suppressHydrationWarning
                    className={inp(false) + ' text-center tracking-[0.5em] font-mono text-lg'}
                  />
                  <Btn loading={loading} label="Verify OTP" />
                </form>
              </motion.div>
            )}

            {/* ── FORGOT — new password ── */}
            {mode === 'forgot-reset' && (
              <motion.div key="f-reset" {...fade}>
                <h2 className="text-lg font-semibold text-white mb-1">New password</h2>
                <p className="text-gray-500 text-xs mb-5">Choose a strong password.</p>
                <form onSubmit={handleForgotReset} noValidate className="space-y-3">
                  <FieldWrap error={newPwdErr} hint="Min 6 characters">
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'} value={newPwd}
                        onChange={e => { setNewPwd(e.target.value); setNewPwdErr(''); }}
                        onBlur={() => setNewPwdErr(validatePassword(newPwd) ?? '')}
                        placeholder="New password" autoFocus
                        suppressHydrationWarning
                        className={inp(!!newPwdErr) + ' pr-10'}
                      />
                      <EyeBtn show={showPwd} toggle={() => setShowPwd(p => !p)} />
                    </div>
                  </FieldWrap>
                  <Btn loading={loading} label="Reset password" />
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>

        {/* Switch */}
        {!isForgot && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="mt-4 bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 text-center text-sm text-gray-400"
          >
            {mode === 'login' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => go('signup')}
                  className="text-indigo-400 font-semibold hover:text-indigo-300 transition">
                  Sign up
                </button></>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => go('login')}
                  className="text-indigo-400 font-semibold hover:text-indigo-300 transition">
                  Sign in
                </button></>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── shared primitives ───────────────────────────────────────── */

const fade = {
  initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 },
};

const inp = (hasError: boolean) =>
  `w-full bg-gray-800 border rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm ` +
  `focus:outline-none focus:ring-2 focus:border-transparent transition ` +
  (hasError
    ? 'border-red-500 focus:ring-red-500'
    : 'border-gray-700 focus:ring-indigo-500');

function FieldWrap({ error, hint, children }: {
  error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="text-red-400 text-[11px] flex items-center gap-1"
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {hint && !error && <span className="text-gray-600 text-[11px]">{hint}</span>}
      </div>
    </div>
  );
}

function Btn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center mt-1">
      {loading ? <Loader size="sm" /> : label}
    </button>
  );
}

function EyeBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle}
      className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-300 transition">
      {show
        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>}
    </button>
  );
}

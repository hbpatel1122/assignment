export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return 'Username is required';
  if (username.trim().length < 3) return 'Username must be at least 3 characters';
  if (username.trim().length > 30) return 'Username must be 30 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim()))
    return 'Username can only contain letters, numbers, and underscores';
  return null;
}

export function validateOtp(otp: string): string | null {
  if (!otp) return 'OTP is required';
  if (!/^\d{6}$/.test(otp)) return 'OTP must be exactly 6 digits';
  return null;
}

/** Returns first error from a list, or null if all pass */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}

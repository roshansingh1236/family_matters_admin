import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

// Captured when the bundle first loads, before supabase-js consumes and clears
// the URL fragment of a Supabase recovery link.
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';

const MIN_PASSWORD_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * request → enter the account email, a reset code is emailed
 * code    → enter the emailed code + the new password
 * link    → arrived from a Supabase recovery link: only the new password is needed
 * done    → password updated
 */
type Step = 'request' | 'code' | 'link' | 'done';

const hashParams = () => new URLSearchParams(INITIAL_HASH.replace(/^#/, ''));

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  // A Supabase recovery link lands here already signed in on a short-lived
  // recovery session — go straight to choosing the new password.
  useEffect(() => {
    const params = hashParams();
    const linkError = params.get('error_description');
    if (linkError) {
      setErrorMessage(`${linkError.replace(/\+/g, ' ')}. Request a new code below.`);
      return;
    }
    if (params.get('type') !== 'recovery') return;

    let cancelled = false;
    setCheckingLink(true);
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setEmail(data.session.user.email ?? '');
        setStep('link');
      } else {
        setErrorMessage('This reset link is invalid or has expired. Request a new code below.');
      }
      setCheckingLink(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const handle = setTimeout(() => setResendSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(handle);
  }, [resendSecondsLeft]);

  /** Emails a reset code; falls back to Supabase's own recovery email. */
  const sendCode = async (targetEmail: string) => {
    let sent = false;
    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { email: targetEmail },
      });
      sent = !error && data?.sent === true;
    } catch (e) {
      console.warn('password-reset function unavailable, falling back', e);
    }
    if (sent) return;

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsLoading(true);
    try {
      await sendCode(trimmed);
      setEmail(trimmed);
      setStep('code');
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setInfoMessage(`If an account exists for ${trimmed}, a reset code is on its way.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to send the reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSecondsLeft > 0 || isLoading || codeVerified) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);
    try {
      await sendCode(email);
      setCode('');
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setInfoMessage(`A new code has been sent to ${email}.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to resend the code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (step === 'code' && !codeVerified && code.trim().length < 6) {
      setErrorMessage('Please enter the code from the email.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // The code is single-use: once accepted, a failed password update can be
      // retried without asking for a new one.
      if (step === 'code' && !codeVerified) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type: 'recovery',
        });
        if (error) {
          const m = (error.message || '').toLowerCase();
          throw new Error(
            m.includes('expired') || m.includes('invalid')
              ? 'That code is invalid or has expired. Request a new code and try again.'
              : error.message,
          );
        }
        setCodeVerified(true);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // End the temporary recovery session so the next sign-in uses the new password.
      await supabase.auth.signOut();
      setStep('done');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to update the password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 pl-10 text-sm bg-white dark:bg-white/5 border border-rose-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 transition-colors disabled:opacity-60";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
  const submitCls = "w-full py-2.5 px-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

  const subtitle =
    step === 'request' ? "Enter your account email and we'll send you a reset code."
    : step === 'code' ? `Enter the code we emailed to ${email} and choose a new password.`
    : step === 'link' ? 'Choose a new password for your account.'
    : 'Your password has been updated.';

  return (
    <div className="min-h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a] flex flex-col items-center justify-center px-4">
      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-gradient-to-br from-rose-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-pink-300/15 to-rose-300/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 rounded-2xl items-center justify-center shadow-xl shadow-rose-500/25 mb-4">
            <i className="ri-lock-password-line text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        <div className="bg-white dark:bg-[#15111f] rounded-3xl shadow-xl shadow-rose-500/5 border border-rose-100/60 dark:border-white/5 p-8 space-y-5">
          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
              <i className="ri-error-warning-line flex-shrink-0"></i>
              {errorMessage}
            </div>
          )}
          {infoMessage && !errorMessage && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <i className="ri-mail-send-line flex-shrink-0"></i>
              {infoMessage}
            </div>
          )}

          {checkingLink && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <i className="ri-loader-4-line animate-spin"></i> Checking your reset link...
            </p>
          )}

          {!checkingLink && step === 'request' && (
            <form className="space-y-5" onSubmit={handleRequest}>
              <div className="space-y-1.5">
                <label htmlFor="email" className={labelCls}>Email</label>
                <div className="relative">
                  <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className={submitCls}>
                {isLoading ? <><i className="ri-loader-4-line animate-spin"></i> Sending...</> : <><i className="ri-mail-send-line"></i> Send reset code</>}
              </button>
            </form>
          )}

          {!checkingLink && (step === 'code' || step === 'link') && (
            <form className="space-y-5" onSubmit={handleReset}>
              {step === 'code' && (
                <div className="space-y-1.5">
                  <label htmlFor="code" className={labelCls}>Reset code</label>
                  <div className="relative">
                    <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required={!codeVerified} disabled={codeVerified} value={codeVerified ? '' : code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder={codeVerified ? 'Code verified' : 'Code from the email'} />
                    <i className="ri-key-2-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="new-password" className={labelCls}>New password</label>
                <div className="relative">
                  <input id="new-password" name="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className={labelCls}>Confirm password</label>
                <div className="relative">
                  <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className={submitCls}>
                {isLoading ? <><i className="ri-loader-4-line animate-spin"></i> Updating...</> : <><i className="ri-check-line"></i> Update password</>}
              </button>

              {step === 'code' && !codeVerified && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading || resendSecondsLeft > 0}
                  className="w-full text-sm font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {resendSecondsLeft > 0 ? `Resend code in ${resendSecondsLeft}s` : "Didn't get the code? Resend"}
                </button>
              )}
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-5">
              <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <i className="ri-checkbox-circle-line flex-shrink-0"></i>
                Password updated. You can now sign in with your new password.
              </div>
              <Link to="/auth/login" className={submitCls}>
                <i className="ri-login-box-line"></i> Back to sign in
              </Link>
            </div>
          )}

          {step !== 'done' && (
            <div className="text-center">
              <Link to="/auth/login" className="text-sm font-medium text-gray-500 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 transition-colors">
                <i className="ri-arrow-left-line"></i> Back to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} Family Matters. All rights reserved.</p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

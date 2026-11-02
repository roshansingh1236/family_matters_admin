import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, initializing } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (initializing) return;
    setIsLoading(true);
    try {
      await login({ email: formData.email.trim(), password: formData.password, rememberMe: formData.rememberMe });
      navigate('/');
    } catch (error: any) {
      const message = error.message || error.error_description || 'Unable to sign in. Please try again.';
      if (message.includes('Invalid login credentials')) setErrorMessage('Invalid email or password.');
      else if (message.includes('Email not confirmed')) setErrorMessage('Please confirm your email before signing in.');
      else setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 pl-10 text-sm bg-white dark:bg-white/5 border border-rose-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 transition-colors";

  return (
    <div className="min-h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a] flex flex-col items-center justify-center px-4">
      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-gradient-to-br from-rose-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-pink-300/15 to-rose-300/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo + brand */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 rounded-2xl items-center justify-center shadow-xl shadow-rose-500/25 mb-4">
            <i className="ri-heart-line text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to Family Matters Admin</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#15111f] rounded-3xl shadow-xl shadow-rose-500/5 border border-rose-100/60 dark:border-white/5 p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                <i className="ri-error-warning-line flex-shrink-0"></i>
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</label>
              <div className="relative">
                <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleInputChange} className={inputCls} placeholder="you@example.com" />
                <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Password</label>
              <div className="relative">
                <input id="password" name="password" type="password" autoComplete="current-password" required value={formData.password} onChange={handleInputChange} className={inputCls} placeholder="••••••••" />
                <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                <input name="rememberMe" type="checkbox" checked={formData.rememberMe} onChange={handleInputChange} className="h-4 w-4 rounded border-rose-200 dark:border-white/20 text-rose-500 focus:ring-rose-500 accent-rose-500" />
                Remember me
              </label>
              <Link to="/auth/forgot-password" className="text-sm font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || initializing}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <><i className="ri-loader-4-line animate-spin"></i> Signing in...</>
               : initializing ? <><i className="ri-time-line"></i> Initializing...</>
               : <><i className="ri-login-box-line"></i> Sign in</>}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rose-100 dark:border-white/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white dark:bg-[#15111f] text-xs text-gray-400">New to Family Matters?</span>
              </div>
            </div>

            <Link
              to="/auth/signup"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-rose-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-white/5 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <i className="ri-user-add-line"></i> Create account
            </Link>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} Family Matters. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LoginPage;

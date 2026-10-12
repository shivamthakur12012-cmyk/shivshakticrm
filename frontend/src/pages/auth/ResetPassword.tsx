import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const resetFormSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type ResetFields = z.infer<typeof resetFormSchema>;

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetFields>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });

  const onSubmit = async (data: ResetFields) => {
    if (!token) {
      setErrorMsg('Reset token is missing in URL parameter.');
      return;
    }
    setErrorMsg(null);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to reset password. Token may be expired.');
    }
  };

  return (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-8 shadow-xl relative overflow-hidden transition-all max-w-md w-full mx-auto">
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Create New Password</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">Choose a new secure password for your account.</p>
      </div>

      {!token && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50 rounded-lg text-yellow-800 dark:text-yellow-400 text-xs font-light">
          <strong>Warning:</strong> No reset token found. Please use the link sent to your email or request a new one.
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-lg flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4 text-center">
          <div className="p-3 bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/50 rounded-lg flex items-start space-x-2 text-green-700 dark:text-green-400 text-xs text-left">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Password Reset Successful!</p>
              <p className="mt-1 font-light">Your password has been changed. You can now log in using your new credentials.</p>
            </div>
          </div>
          <Link 
            to="/login" 
            className="inline-block bg-primary-600 text-white font-semibold py-2 px-5 rounded-lg text-sm hover:bg-primary-700 transition"
          >
            Log In Now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={`w-full px-4 py-2.5 pr-11 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${
                  errors.password ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:text-dark-500 dark:hover:text-dark-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${
                errors.confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm shadow-md transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Resetting...</span>
              </>
            ) : (
              <span>Reset Password</span>
            )}
          </button>

          <div className="text-center text-xs text-slate-500 dark:text-dark-400">
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Back to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

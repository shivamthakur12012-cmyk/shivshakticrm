import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const forgotFormSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

type ForgotFields = z.infer<typeof forgotFormSchema>;

export const ForgotPassword: React.FC = () => {
  const [isSent, setIsSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotFields>({
    resolver: zodResolver(forgotFormSchema),
    defaultValues: { email: '' }
  });

  const onSubmit = async (data: ForgotFields) => {
    setErrorMsg(null);
    try {
      const response = await api.post('/auth/forgot-password', data);
      setIsSent(true);
      if (response.data.devResetToken) {
        setDevToken(response.data.devResetToken);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to request reset link.');
    }
  };

  return (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-8 shadow-xl relative overflow-hidden transition-all max-w-md w-full mx-auto">
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Reset Password</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">Enter your email and we'll send you a password reset link.</p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-lg flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isSent ? (
        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/50 rounded-lg flex items-start space-x-2 text-green-700 dark:text-green-400 text-xs">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Reset Link Sent Successfully!</p>
              <p className="mt-1 font-light">Check your inbox for further instructions. If the email is registered, you will receive a reset link.</p>
            </div>
          </div>

          {devToken && (
            <div className="p-4 bg-slate-100 dark:bg-dark-950 rounded-xl border border-slate-200 dark:border-dark-850 space-y-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-350 block">Development Environment Helper:</span>
              <p className="text-[10px] text-slate-500 font-mono break-all bg-white dark:bg-dark-900 p-2 rounded border border-slate-200 dark:border-dark-800">
                {devToken}
              </p>
              <Link 
                to={`/reset-password?token=${devToken}`}
                className="inline-block bg-primary-600 text-white font-semibold py-1.5 px-3 rounded text-[11px] hover:bg-primary-700 transition"
              >
                Proceed to Reset Password
              </Link>
            </div>
          )}

          <div className="text-center pt-2">
            <Link to="/login" className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="shivamthakur12012@gmail.com"
              {...register('email')}
              className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${
                errors.email ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm shadow-md transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending link...</span>
              </>
            ) : (
              <span>Send Reset Link</span>
            )}
          </button>

          <div className="text-center text-xs text-slate-500 dark:text-dark-400">
            <span>Remember your password? </span>
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Log in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

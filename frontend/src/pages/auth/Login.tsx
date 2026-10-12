import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type LoginFields = z.infer<typeof loginFormSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const loginStore = useAuthStore((state) => state.login);

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFields>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (data: LoginFields) => {
    setErrorMsg(null);
    try {
      const response = await api.post('/auth/login', data);
      const { token, user, organizations } = response.data.data;

      loginStore(token, user, organizations);

      const isSuperAdmin = user?.email === 'shivamthakur12012@gmail.com';
      if (isSuperAdmin) {
        navigate('/super-admin');
      } else if (organizations.length === 0) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to authenticate. Please check connection.';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-8 shadow-xl relative overflow-hidden transition-all">
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome Back</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">Log in to manage your business operations.</p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-lg flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <input
            type="email"
            placeholder="shivamthakur12012@gmail.com"
            {...register('email')}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
              }`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className={`w-full px-4 py-2.5 pr-11 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
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

        {/* Remember / Consent */}
        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-dark-800 bg-transparent"
          />
          <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-500 dark:text-dark-400">
            Keep me logged in on this device
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm shadow-md transition-all flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log In</span>
          )}
        </button>
      </form>

      {/* Register Redirect */}
      <div className="mt-6 text-center text-xs text-slate-500 dark:text-dark-400">
        <span>Don't have an account? </span>
        <Link
          to="/register"
          className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          Sign up now
        </Link>
      </div>
    </div>
  );
};

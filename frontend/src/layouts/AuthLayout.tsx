import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const AuthLayout: React.FC = () => {
  const { isAuthenticated, organizations, user } = useAuthStore();
  const isSuperAdmin = user?.email === 'shivamthakur12012@gmail.com';

  // If already authenticated, redirect away from public auth pages
  if (isAuthenticated) {
    if (isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    }
    if (organizations.length === 0) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-dark-950 transition-colors duration-200">
      {/* Left Column: Visual branding banner */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-900 dark:from-primary-950 dark:to-dark-900 p-12 flex-col justify-between text-white relative overflow-hidden">
        {/* Decorative Grid SVG background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="z-10 flex items-center space-x-3.5">
          <img src="/logo.svg" alt="PCS Logo" className="h-12 w-auto max-w-[160px] object-contain drop-shadow-md" />
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-widest uppercase bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-white">
              CRM Portal
            </span>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="z-10 max-w-md my-auto space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            The Operating System for Modern Businesses.
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed font-light">
            Manage your sales pipeline, deals, payments, GST invoices, and service workflows inside a secure, permission-aware environment.
          </p>
          <div className="flex items-center space-x-4 pt-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold">1</div>
              <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold">2</div>
              <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold">3</div>
            </div>
            <span className="text-sm text-primary-200">Trusted by over 100+ professional consultancy teams.</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 text-xs text-primary-300 font-light flex justify-between">
          <span>&copy; {new Date().getFullYear()} PCS. All rights reserved.</span>
          <span className="hover:underline cursor-pointer">Privacy Policy</span>
        </div>
      </div>

      {/* Right Column: Dynamic login/register form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

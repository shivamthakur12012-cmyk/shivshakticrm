import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const registerFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  organizationName: z.string().min(1, 'Company name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  businessType: z.enum(['general', 'loan', 'registration', 'certification', 'custom']),
  bankName: z.string().min(1, 'Bank name is required for quotations'),
  bankAccount: z.string().min(8, 'Bank account number is required (min 8 digits)'),
  bankIfsc: z.string().min(4, 'IFSC code is required (e.g. HDFC0001234)'),
  bankUpi: z.string().optional().or(z.literal(''))
});

type RegisterFields = z.infer<typeof registerFormSchema>;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFields>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      organizationName: 'PCS',
      phone: '',
      businessType: 'general',
      bankName: '',
      bankAccount: '',
      bankIfsc: '',
      bankUpi: ''
    }
  });

  const onSubmit = async (data: RegisterFields) => {
    setErrorMsg(null);
    try {
      await api.post('/auth/register', data);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to register account. Please check connection.';
      setErrorMsg(msg);
    }
  };

  if (success) {
    return (
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registration Successful!</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">
          Your staff account has been created. Redirecting to login...
        </p>
        <div className="flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-8 shadow-xl relative overflow-hidden transition-all max-h-[85vh] overflow-y-auto">
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Create Staff Account</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">Register your employee account for PCS.</p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-lg flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              First Name
            </label>
            <input
              type="text"
              placeholder="Shivam"
              {...register('firstName')}
              className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.firstName ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
            />
            {errors.firstName && (
              <p className="mt-1 text-[10px] text-red-500">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              Last Name
            </label>
            <input
              type="text"
              placeholder="Thakur"
              {...register('lastName')}
              className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.lastName ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
            />
            {errors.lastName && (
              <p className="mt-1 text-[10px] text-red-500">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              {...register('email')}
              className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
            />
            {errors.email && (
              <p className="mt-1 text-[10px] text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="9876543210"
              {...register('phone')}
              className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.phone ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
            />
            {errors.phone && (
              <p className="mt-1 text-[10px] text-red-500">{errors.phone.message}</p>
            )}
          </div>
        </div>

        {/* Company Settings */}
        <div className="border-t border-slate-100 dark:border-dark-800/50 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Company / Organization Name
              </label>
              <input
                type="text"
                placeholder="Acme Consultancy Services"
                {...register('organizationName')}
                className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.organizationName ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                  }`}
              />
              {errors.organizationName && (
                <p className="mt-1 text-[10px] text-red-500">{errors.organizationName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Business Category
              </label>
              <select
                {...register('businessType')}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-dark-800 text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer"
              >
                <option value="general">General Sales & Service</option>
                <option value="loan">Business Loan Consultancy</option>
                <option value="registration">Business Registration Services</option>
                <option value="certification">Business Certification Services</option>
                <option value="custom">Other Consultancy Business</option>
              </select>
            </div>
          </div>
        </div>

        {/* Organization Bank Details (Auto Quotations) */}
        <div className="pt-2 border-t border-slate-100 dark:border-dark-800 space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Bank Settlement Details (for Quotations & Invoices)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-dark-400">
              Your banking details will automatically populate on official quotations and invoices.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Bank Name *
              </label>
              <input
                type="text"
                placeholder="HDFC Bank"
                {...register('bankName')}
                className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${
                  errors.bankName ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
              />
              {errors.bankName && <p className="mt-1 text-[10px] text-red-500">{errors.bankName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                Account Number *
              </label>
              <input
                type="text"
                placeholder="50200084729104"
                {...register('bankAccount')}
                className={`w-full px-4 py-2 rounded-lg border text-sm font-mono bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${
                  errors.bankAccount ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
              />
              {errors.bankAccount && <p className="mt-1 text-[10px] text-red-500">{errors.bankAccount.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                IFSC Code *
              </label>
              <input
                type="text"
                placeholder="HDFC0001234"
                {...register('bankIfsc')}
                className={`w-full px-4 py-2 rounded-lg border text-sm font-mono uppercase bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${
                  errors.bankIfsc ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
                }`}
              />
              {errors.bankIfsc && <p className="mt-1 text-[10px] text-red-500">{errors.bankIfsc.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                UPI ID (Optional)
              </label>
              <input
                type="text"
                placeholder="company@okhdfcbank"
                {...register('bankUpi')}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-dark-800 text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
            Choose Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className={`w-full px-4 py-2 rounded-lg border text-sm bg-slate-50 dark:bg-dark-950 text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-dark-800'
              }`}
          />
          {errors.password && (
            <p className="mt-1 text-[10px] text-red-500">{errors.password.message}</p>
          )}
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
              <span>Creating organization account...</span>
            </>
          ) : (
            <span>Sign Up</span>
          )}
        </button>
      </form>

      {/* Login redirect */}
      <div className="mt-6 text-center text-xs text-slate-500 dark:text-dark-400">
        <span>Already have an account? </span>
        <Link
          to="/login"
          className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          Log in
        </Link>
      </div>
    </div>
  );
};

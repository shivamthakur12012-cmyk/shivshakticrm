import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { 
  Building2, Briefcase, FileSignature, Wallet, ChevronRight, 
  ChevronLeft, CheckCircle, Loader2, AlertCircle, LogOut
} from 'lucide-react';

const onboardingSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  businessType: z.enum(['general', 'loan', 'registration', 'certification', 'custom']),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  gstin: z.string().length(15, 'GSTIN must be exactly 15 characters').optional().or(z.literal('')),
  pan: z.string().length(10, 'PAN must be exactly 10 characters').optional().or(z.literal('')),
  bankName: z.string().min(1, 'Bank name is required for quotations'),
  bankAccount: z.string().min(8, 'Bank account number is required (min 8 digits)'),
  bankIfsc: z.string().min(4, 'IFSC code is required (e.g. HDFC0001234)'),
  bankUpi: z.string().optional().or(z.literal('')),
  template: z.string().default('general_sales')
});

type OnboardingFields = z.infer<typeof onboardingSchema>;

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, organizations, setOrganizations, setActiveOrganizationId, logout } = useAuthStore();
  const isSuperAdmin = user?.email === 'shivamthakur12012@gmail.com' || user?.role === 'Super Admin' || (user as any)?.isSuperAdmin;
  const [step, setStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else if (isSuperAdmin) {
      navigate('/super-admin', { replace: true });
    } else if (organizations && organizations.length > 0) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isSuperAdmin, organizations, navigate]);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors, isSubmitting } } = useForm<OnboardingFields>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      businessType: 'general',
      phone: '',
      email: user?.email || '',
      website: '',
      gstin: '',
      pan: '',
      bankName: '',
      bankAccount: '',
      bankIfsc: '',
      bankUpi: '',
      template: 'general_sales'
    }
  });

  const selectedBusinessType = watch('businessType');

  // Sync template choice based on business category choice
  React.useEffect(() => {
    if (selectedBusinessType === 'loan') {
      setValue('template', 'business_loan');
    } else if (selectedBusinessType === 'registration' || selectedBusinessType === 'certification') {
      setValue('template', 'registration_certification');
    } else {
      setValue('template', 'general_sales');
    }
  }, [selectedBusinessType, setValue]);

  const handleNextStep = async () => {
    if (step === 1) {
      const isValid = await trigger(['name', 'phone', 'email', 'website', 'bankName', 'bankAccount', 'bankIfsc']);
      if (!isValid) {
        setErrorMsg('Please complete company and bank settlement fields before continuing.');
        return;
      }
    }
    setErrorMsg(null);
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setStep(prev => prev - 1);
  };

  const onSubmit = async (data: OnboardingFields) => {
    setErrorMsg(null);
    try {
      // 1. Onboard organization API request
      const response = await api.post('/organizations/onboard', {
        name: data.name,
        businessType: data.businessType,
        phone: data.phone,
        email: data.email,
        website: data.website,
        gstin: data.gstin,
        pan: data.pan,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankIfsc: data.bankIfsc,
        bankUpi: data.bankUpi
      });

      // 2. Fetch fresh user context to load the newly affiliated organization
      const meResponse = await api.get('/auth/me');
      const { organizations } = meResponse.data?.data || {};
      
      if (organizations && Array.isArray(organizations) && organizations.length > 0) {
        setOrganizations(organizations);
      }
      
      const newOrgId = response.data?.data?._id || response.data?.data?.id || organizations?.[0]?.id || organizations?.[0]?._id;
      if (newOrgId) {
        setActiveOrganizationId(newOrgId);
      }

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to complete onboarding. Please verify details.';
      setErrorMsg(msg);
    }
  };

  const businessTypes = [
    { value: 'general', label: 'General Sales & Service', icon: Building2, desc: 'For general trade, product sales, and custom consulting.' },
    { value: 'loan', label: 'Business Loan Consultancy', icon: Wallet, desc: 'Auto-configures document checklists and bank processing workflows.' },
    { value: 'registration', label: 'Business Registration Services', icon: FileSignature, desc: 'Configures government processing and company filing tracking.' },
    { value: 'certification', label: 'Certification Services', icon: CheckCircle, desc: 'Configures audit, verification, and certificate dispatch stages.' },
    { value: 'custom', label: 'Other Consulting Business', icon: Briefcase, desc: 'A blank canvas setup to map your custom pipelines.' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex items-center justify-center p-6 transition-colors duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-8 md:p-12 shadow-2xl space-y-8">
        
        {/* Progress Tracker bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-dark-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Workspace Configuration Wizard</h1>
            <p className="text-sm text-slate-500 dark:text-dark-400">Configure your company settings and service templates.</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm font-semibold text-slate-400 dark:text-dark-500">
              Step {step} of 3
            </div>
            {user && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.post('/auth/logout');
                  } catch {}
                  logout();
                  navigate('/login');
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-100 dark:bg-dark-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-dark-300 hover:text-rose-600 text-xs font-bold transition"
                title="Log out of current account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-xl flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* STEP 1: Basic Company Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">1. Company Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Company / Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="PCS"
                    {...register('name')}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Company Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="9999999999"
                    {...register('phone')}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Company Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="info@pcs.com"
                    {...register('email')}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Website URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://www.pcs.com"
                    {...register('website')}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website.message}</p>}
                </div>
              </div>

              {/* Organization Bank Settlement Section */}
              <div className="pt-4 border-t border-slate-100 dark:border-dark-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Organization Bank Settlement Details</h3>
                  <p className="text-xs text-slate-500 dark:text-dark-400">Required for automatically populating banking details on quotations and invoices.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank, ICICI Bank"
                      {...register('bankName')}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    {errors.bankName && <p className="mt-1 text-xs text-red-500">{errors.bankName.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                      Bank Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 50200084729104"
                      {...register('bankAccount')}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    {errors.bankAccount && <p className="mt-1 text-xs text-red-500">{errors.bankAccount.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      {...register('bankIfsc')}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm uppercase font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    {errors.bankIfsc && <p className="mt-1 text-xs text-red-500">{errors.bankIfsc.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                      UPI ID / Handle (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. company@okhdfcbank"
                      {...register('bankUpi')}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Business Type selection */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">2. Select Business Operations Category</h2>
              <p className="text-xs text-slate-400 dark:text-dark-500">This pre-configures custom status pipelines, CRM checklists, and tax settings.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {businessTypes.map(t => {
                  const Icon = t.icon;
                  const isSelected = selectedBusinessType === t.value;
                  return (
                    <div
                      key={t.value}
                      onClick={() => setValue('businessType', t.value as any)}
                      className={`flex items-start p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/10' 
                          : 'border-slate-100 dark:border-dark-800 hover:bg-slate-50 dark:hover:bg-dark-800/40'
                      }`}
                    >
                      <div className={`p-2 rounded-xl mr-3 ${
                        isSelected ? 'bg-primary-100 text-primary-600 dark:bg-primary-900' : 'bg-slate-100 text-slate-500 dark:bg-dark-800'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t.label}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-dark-500 mt-0.5 leading-relaxed">{t.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Indian Tax & GST configuration */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">3. Tax and Statutory Details (India)</h2>
              <p className="text-xs text-slate-400 dark:text-dark-500">Configure Indian GST tax profiles to generate professional billing receipts.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    GSTIN Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="27AAAAA1111A1Z1"
                    maxLength={15}
                    {...register('gstin')}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.gstin && <p className="mt-1 text-xs text-red-500">{errors.gstin.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-300 uppercase tracking-wider mb-1">
                    Company PAN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    {...register('pan')}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.pan && <p className="mt-1 text-xs text-red-500">{errors.pan.message}</p>}
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-dark-950/40 rounded-2xl flex items-center justify-between text-xs text-slate-500">
                <span>By finalizing, we will pre-configure GST components (CGST, SGST, IGST) with standard 18% tax rates.</span>
              </div>
            </div>
          )}

          {/* Form Actions footer */}
          <div className="flex justify-between items-center border-t border-slate-100 dark:border-dark-800 pt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 dark:text-dark-300 text-sm font-semibold"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow-md transition flex items-center space-x-2"
              >
                <span>Continue</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow-md transition flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Configuring CRM...</span>
                  </>
                ) : (
                  <>
                    <span>Finish Setup</span>
                    <CheckCircle className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

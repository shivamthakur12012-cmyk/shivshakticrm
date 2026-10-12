import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  RefreshCw, UserPlus, Users, X,
  AlertTriangle, CheckCircle2,
  Check,
  Building2, QrCode, Sparkles, Trash2
} from 'lucide-react';

export const AdminAssignment: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, organizations, activeOrganizationId } = useAuthStore();
  const activeOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];
  const currentRole = activeOrg?.role || (user?.email === 'shivamthakur12012@gmail.com' ? 'Admin' : 'Sale Executive');

  // 4-Tier Hierarchy: 1. Admin, 2. Manager, 3. Team Leader, 4. Sale Executive
  const isAdmin = ['Super Admin', 'Admin'].includes(currentRole) || user?.email === 'shivamthakur12012@gmail.com';
  const isSuperAdmin = isAdmin;

  // Register Employee Modal State (4-level hierarchy)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Manager' | 'Team Leader' | 'Sale Executive'>('Sale Executive');

  // Quick Seat Addon Modal State
  const [showAddSeatsModal, setShowAddSeatsModal] = useState(false);
  const [seatsToAdd, setSeatsToAdd] = useState<number>(1);
  const [seatCompanyName, setSeatCompanyName] = useState<string>('');
  const [userSeatPaymentId, setUserSeatPaymentId] = useState<string>('');
  const [isSeatSubmitted, setIsSeatSubmitted] = useState<boolean>(false);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [seatSuccessMsg, setSeatSuccessMsg] = useState<string | null>(null);

  // Delete Employee State
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Fetch Detailed Employees List & Seat Quotas
  const { data: employeesResponse, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['team-employees-list'],
    queryFn: async () => {
      const res = await api.get('/assignment/employees');
      return res.data;
    }
  });

  const employeesData = employeesResponse?.data || [];
  const seatMeta = employeesResponse?.meta || {
    totalEmployees: employeesData.length,
    seatLimit: 10,
    isLimitReached: false,
    pricePerSeat: 500,
    planName: 'Starter'
  };

  // Register Employee Mutation (Admin only)
  const registerEmployeeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/assignment/employees', payload);
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Team member registered successfully.');
      queryClient.invalidateQueries({ queryKey: ['team-employees-list'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-config'] });
      queryClient.invalidateQueries({ queryKey: ['employees-master-list'] });
      queryClient.invalidateQueries({ queryKey: ['org-billing-subscription'] });
      setShowRegisterModal(false);
      resetRegisterForm();
    },
    onError: (err: any) => {
      if (err.response?.data?.errorCode === 'EMPLOYEE_LIMIT_REACHED') {
        setShowRegisterModal(false);
        setShowAddSeatsModal(true);
        setSeatError(err.response?.data?.message || 'Employee seat capacity reached. Please purchase extra seats.');
      } else {
        alert(err.response?.data?.message || 'Failed to register team member.');
      }
    }
  });

  // Seat Add-on Payment Request Mutation for Super Admin Verification
  const submitSeatPaymentMutation = useMutation({
    mutationFn: async (payload: { extraSeats: number; companyName: string; transactionId: string }) => {
      const res = await api.post('/billing/submit-seat-payment', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-employees-list'] });
      queryClient.invalidateQueries({ queryKey: ['org-billing-subscription'] });
      setIsSeatSubmitted(true);
      setSeatError(null);
      setSeatSuccessMsg(data.message || 'Seat payment submitted for Super Admin verification!');
    },
    onError: (err: any) => {
      setSeatError(err.response?.data?.message || 'Failed to submit seat add-on request.');
    }
  });

  // Toggle Employee Status Mutation (Admin only)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) => {
      const res = await api.patch(`/assignment/employees/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-employees-list'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-config'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to toggle employee status.');
    }
  });

  // Delete Employee Mutation (Admin only)
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/assignment/employees/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Team member deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['team-employees-list'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-config'] });
      queryClient.invalidateQueries({ queryKey: ['employees-master-list'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete team member.');
    }
  });

  const resetRegisterForm = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('Sale Executive');
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'Admin':
      case 'Super Admin':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
            1. Admin
          </span>
        );
      case 'Manager':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
            2. Manager
          </span>
        );
      case 'Team Leader':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
            3. Team Leader
          </span>
        );
      case 'Sale Executive':
      case 'Sales Executive':
      case 'Employee':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
            4. Sale Executive
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Live Seat Capacity Meter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white">
              Register Employee & Team Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
              {isSuperAdmin
                ? 'Register new employees, assign hierarchy roles, and manage active team accounts.'
                : 'View registered team members and organizational directory.'}
            </p>
          </div>
        </div>

        {/* Seat Counter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`px-3.5 py-2 rounded-2xl border text-xs flex items-center space-x-2 ${seatMeta.isLimitReached
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
            : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-200'
            }`}>
            <Users className="h-4 w-4 text-blue-500" />
            <span className="font-semibold">Team Seats:</span>
            <strong className="font-black">
              {employeesData.length} / {seatMeta.seatLimit === -1 ? 'Unlimited' : seatMeta.seatLimit}
            </strong>
          </div>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSeatError(null);
                  setShowAddSeatsModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                title="Add more employee seats at ₹500/seat"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                <span>+ Add Seats (₹500/seat)</span>
              </button>

              <button
                onClick={() => {
                  if (seatMeta.isLimitReached) {
                    setShowAddSeatsModal(true);
                    setSeatError(`Team seat limit of ${seatMeta.seatLimit} reached. Please add extra employee seats (₹500/seat) to continue.`);
                  } else {
                    setShowRegisterModal(true);
                  }
                }}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white font-black text-xs transition shadow-md active:scale-95 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Register Employee</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TEAM & EMPLOYEES DIRECTORY */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-dark-800 pb-4">
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span>Registered Team Members</span>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 text-xs font-black">
                {(employeesData || []).length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Manage employee accounts, role assignments, status, and active system access.
            </p>
          </div>
        </div>

        {isLoadingEmployees ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading team members...</div>
        ) : !employeesData || employeesData.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Users className="h-8 w-8 text-slate-300 dark:text-dark-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-white">No Employees Registered</p>
            <p className="text-xs text-slate-400">
              {isSuperAdmin ? 'Click "Register Employee" to add team members.' : 'No team members found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-dark-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600 dark:text-dark-300">
              <thead className="bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-white font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Team Member</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                {employeesData.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition">
                    <td className="p-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {emp.firstName.charAt(0)}{emp.lastName?.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-dark-400 font-mono text-[11px]">{emp.email}</td>
                    <td className="p-3">
                      {getRoleBadge(emp.role)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        }`}>
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {isSuperAdmin ? (
                        (() => {
                          const isEmpProtected =
                            emp.role === 'Super Admin' ||
                            emp.role === 'Admin' ||
                            emp.id === user?.id ||
                            emp.email === 'shivamthakur12012@gmail.com';

                          if (isEmpProtected) {
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-dark-800 dark:text-dark-400">
                                Protected Admin
                              </span>
                            );
                          }

                          return (
                            <div className="inline-flex items-center space-x-1.5">
                              <button
                                onClick={() => toggleStatusMutation.mutate({
                                  id: emp.id,
                                  status: emp.status === 'active' ? 'inactive' : 'active'
                                })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${emp.status === 'active'
                                  ? 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 dark:bg-dark-800 dark:hover:bg-amber-950/30 dark:text-dark-400 dark:hover:text-amber-400'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  }`}
                              >
                                {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>

                              <button
                                onClick={() => setDeleteTarget(emp)}
                                title="Delete employee"
                                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-400 transition cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-dark-500 font-medium italic">
                          View Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REGISTER EMPLOYEE MODAL (Super Admin only) */}
      {showRegisterModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Register New Employee</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                registerEmployeeMutation.mutate({
                  firstName: newFirstName,
                  lastName: newLastName,
                  email: newEmail,
                  password: newPassword,
                  role: newRole
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-white mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Verma"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="employee@pcs.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">Initial Password * (min 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-white mb-1">Hierarchy Level / Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-white outline-none font-semibold cursor-pointer"
                >
                  <option value="Admin">1. Admin (Full system & organization control)</option>
                  <option value="Manager">2. Manager (Team management, unassigned queues, reports)</option>
                  <option value="Team Leader">3. Team Leader (Supervise team of sales executives, allocate leads)</option>
                  <option value="Sale Executive">4. Sale Executive (Direct client outreach, follow-ups, quotes)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-dark-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-dark-300 font-bold hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerEmployeeMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:brightness-110 text-white font-black text-xs transition shadow-md disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  {registerEmployeeMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{registerEmployeeMutation.isPending ? 'Registering...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE EMPLOYEE CONFIRMATION MODAL (Super Admin only) */}
      {deleteTarget && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Delete Employee Account</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-dark-300">
              <p>
                Are you sure you want to permanently delete team member <strong className="text-slate-900 dark:text-white">{deleteTarget.firstName} {deleteTarget.lastName}</strong> (<span className="font-mono">{deleteTarget.email}</span>)?
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-dark-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-dark-300 font-bold hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteEmployeeMutation.isPending}
                onClick={() => deleteEmployeeMutation.mutate(deleteTarget.id)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-md disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                {deleteEmployeeMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{deleteEmployeeMutation.isPending ? 'Deleting...' : 'Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SEAT ADD-ON MODAL */}
      {showAddSeatsModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white">Add Extra Employee Seats</h3>
                  <p className="text-[11px] text-slate-400">Expand your organization team capacity at ₹500/seat</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddSeatsModal(false);
                  setIsSeatSubmitted(false);
                  setUserSeatPaymentId('');
                  setSeatError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {seatError && (
              <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-xs flex items-center space-x-2 border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                <span>{seatError}</span>
              </div>
            )}

            {seatSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2 border border-emerald-200 dark:border-emerald-900 font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>{seatSuccessMsg}</span>
              </div>
            )}

            {isSeatSubmitted ? (
              <div className="py-6 text-center space-y-4 animate-in fade-in">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
                  <Check className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Seat Request Submitted!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-dark-300 max-w-sm mx-auto">
                    Your request for +{seatsToAdd} extra seats (UTR: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{userSeatPaymentId}</strong>) has been submitted for Super Admin verification.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Your team quota will be updated immediately upon Super Admin approval.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSeatsModal(false);
                      setIsSeatSubmitted(false);
                      setUserSeatPaymentId('');
                    }}
                    className="px-6 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] text-white text-xs font-bold shadow-md hover:brightness-110 transition"
                  >
                    Done / Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!seatCompanyName.trim()) {
                    setSeatError('Please enter your company name.');
                    return;
                  }
                  if (!userSeatPaymentId.trim()) {
                    setSeatError('Please enter your payment Transaction Number / UTR Reference ID.');
                    return;
                  }
                  submitSeatPaymentMutation.mutate({
                    extraSeats: seatsToAdd,
                    companyName: seatCompanyName.trim(),
                    transactionId: userSeatPaymentId.trim()
                  });
                }}
                className="space-y-4 text-xs"
              >
                {/* Stepper Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block">Number of Seats to Add</span>
                      <span className="text-[11px] text-slate-400">Fixed rate: ₹500 per additional employee</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSeatsToAdd(prev => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-black text-xs text-blue-600 dark:text-blue-400">
                        +{seatsToAdd}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSeatsToAdd(prev => prev + 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Presets:</span>
                    {[1, 2, 5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSeatsToAdd(num)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${seatsToAdd === num
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-white dark:bg-dark-900 text-slate-600 dark:text-dark-300 border border-slate-200 dark:border-dark-700'
                          }`}
                      >
                        +{num} (₹{(num * 500).toLocaleString()})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total Summary */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Payable</span>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      ₹{(seatsToAdd * 500).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs inline-block">
                      New Limit: {seatMeta.seatLimit === -1 ? 'Unlimited' : seatMeta.seatLimit + seatsToAdd} Seats
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Currently {employeesData.length} / {seatMeta.seatLimit} in use
                    </span>
                  </div>
                </div>

                {/* Company Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-dark-200 mb-1">
                    Organization / Company Name <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Enter company name..."
                      value={seatCompanyName || activeOrg?.name || ''}
                      onChange={(e) => setSeatCompanyName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Payment Scanner QR */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 space-y-2 text-center animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-800 pb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-dark-200 flex items-center space-x-1.5">
                      <QrCode className="h-4 w-4 text-emerald-500" />
                      <span>Scan Payment QR Code</span>
                    </span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      ₹{(seatsToAdd * 500).toLocaleString()} INR
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-2xl max-w-[170px] mx-auto shadow-md border border-slate-200">
                    <img
                      src="/payment-qr.png"
                      onError={(e) => {
                        (e.target as any).src = "https://lh3.googleusercontent.com/d/1R-Zzmk5XWgsFfQh_k76xUeZzt9lPi2QJ";
                      }}
                      alt="Official Payment Scanner"
                      className="w-full h-auto object-contain rounded-xl"
                    />
                  </div>
                </div>

                {/* Transaction UTR Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-dark-200">
                    Transaction Number / UPI UTR / Reference ID <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 429381748291..."
                    value={userSeatPaymentId}
                    onChange={(e) => setUserSeatPaymentId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-dark-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSeatsModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-dark-300 font-bold hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitSeatPaymentMutation.isPending || !userSeatPaymentId.trim()}
                    className="px-5 py-2.5 rounded-xl [background:linear-gradient(45deg,#ef4444,#6366f1,#2563eb)] hover:brightness-110 text-white font-black text-xs transition shadow-md disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    {submitSeatPaymentMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>{submitSeatPaymentMutation.isPending ? 'Submitting...' : 'Submit for Super Admin Verification'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

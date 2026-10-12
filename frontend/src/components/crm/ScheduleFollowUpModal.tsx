import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Calendar, X, Check, Loader2, AlertCircle
} from 'lucide-react';

interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    _id: string;
    name: string;
    phone?: string;
    company?: string;
    leadId?: string;
    status?: string;
    nextFollowUp?: string;
  } | null;
  onSuccess?: () => void;
}

export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // Helper to format date YYYY-MM-DD
  const formatDateForInput = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateForInput(d);
  };

  const [date, setDate] = useState<string>(getTomorrowDate());
  const [time, setTime] = useState<string>('11:00 AM');
  const [type, setType] = useState<string>('phone');
  const [priority, setPriority] = useState<string>('medium');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen && lead) {
      if (lead.nextFollowUp) {
        try {
          const existingDate = new Date(lead.nextFollowUp);
          setDate(formatDateForInput(existingDate));
        } catch {
          setDate(getTomorrowDate());
        }
      } else {
        setDate(getTomorrowDate());
      }
      setTime('11:00 AM');
      setType('phone');
      setPriority('medium');
      setNotes(`Follow-up with ${lead.name || 'client'} regarding requirement.`);
      setErrorMsg(null);
    }
  }, [isOpen, lead]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!lead?._id) throw new Error('Lead ID is missing');
      if (!date) throw new Error('Please choose a valid follow-up date');

      const res = await api.post('/followups', {
        leadId: lead._id,
        date: new Date(`${date}T12:00:00.000Z`).toISOString(),
        time,
        type,
        priority,
        notes: notes.trim(),
        purpose: notes.trim() || 'Scheduled Follow-up'
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['followups-planner'] });
      if (lead?._id) {
        queryClient.invalidateQueries({ queryKey: ['lead-detail', lead._id] });
      }
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to schedule follow-up.');
    }
  });

  if (!isOpen || !lead) return null;

  const handlePresetDate = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    setDate(formatDateForInput(target));
  };

  const timeSlots = [
    '10:00 AM',
    '11:30 AM',
    '02:00 PM',
    '03:30 PM',
    '05:00 PM',
    '06:30 PM'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-lg rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl overflow-hidden"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md shadow-red-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Schedule Follow-Up
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {lead.leadId ? `#${lead.leadId} • ` : ''}
                <strong className="text-slate-700 dark:text-slate-200">{lead.name}</strong>
                {lead.company ? ` (${lead.company})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            scheduleMutation.mutate();
          }}
          className="p-6 space-y-4"
        >
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Date Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Quick Date Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handlePresetDate(0)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition ${
                  date === formatDateForInput(new Date())
                    ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white border-transparent shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePresetDate(1)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition ${
                  date === getTomorrowDate()
                    ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white border-transparent shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handlePresetDate(2)}
                className="py-1.5 px-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              >
                In 2 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetDate(7)}
                className="py-1.5 px-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              >
                In 1 Week
              </button>
            </div>
          </div>

          {/* Date & Time Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Follow-Up Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  min={formatDateForInput(new Date())}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Scheduled Time *
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Channel Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Follow-Up Channel
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="phone">📞 Phone Call</option>
                <option value="whatsapp">💬 WhatsApp Message</option>
                <option value="email">✉️ Email</option>
                <option value="meeting">🤝 Meeting / Video Call</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority (Urgent)</option>
              </select>
            </div>
          </div>

          {/* Notes / Agenda */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Discussion Purpose / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Discuss proposal pricing, answer queries..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduleMutation.isPending}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white text-xs font-black shadow-md shadow-red-500/20 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              {scheduleMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Follow-Up</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

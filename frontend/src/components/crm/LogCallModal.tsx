import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  PhoneCall, X, Send, Loader2, AlertCircle, Clock, CheckCircle2
} from 'lucide-react';

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    _id?: string;
    id?: string;
    name: string;
    phone?: string;
    company?: string;
    leadId?: string;
  } | null;
  onSuccess?: () => void;
}

export const LogCallModal: React.FC<LogCallModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [callType, setCallType] = useState<'OUTGOING' | 'INCOMING' | 'MISSED'>('OUTGOING');
  const [outcome, setOutcome] = useState('Connected');
  const [duration, setDuration] = useState(45);
  const [callNotes, setCallNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const outcomes = [
    { label: 'Connected', color: 'emerald' },
    { label: 'Interested', color: 'blue' },
    { label: 'Callback', color: 'amber' },
    { label: 'Busy / No Answer', color: 'slate' },
    { label: 'Wrong Number', color: 'rose' }
  ];

  const durationPresets = [
    { label: '15s', value: 15 },
    { label: '45s', value: 45 },
    { label: '2 min', value: 120 },
    { label: '5 min', value: 300 },
    { label: '10 min', value: 600 }
  ];

  useEffect(() => {
    if (isOpen) {
      setCallType('OUTGOING');
      setOutcome('Connected');
      setDuration(45);
      setCallNotes('');
      setErrorMsg(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const logCallMutation = useMutation({
    mutationFn: async () => {
      const targetId = lead?._id || lead?.id;
      if (!targetId) throw new Error('Lead ID is missing');

      const res = await api.post(`/leads/${targetId}/log-call`, {
        phoneNumber: lead.phone,
        callType,
        duration: callType === 'MISSED' ? 0 : duration,
        outcome: callType === 'MISSED' ? 'Missed / Rejected' : outcome,
        notes: callNotes.trim()
      });
      return res.data;
    },
    onSuccess: () => {
      const targetId = lead?._id || lead?.id;
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: ['lead-detail', targetId] });
      }
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to log call.');
    }
  });

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logCallMutation.mutate();
  };

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
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Log Phone Call Result</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {lead.leadId ? `#${lead.leadId} • ` : ''}
                <strong className="text-slate-700 dark:text-slate-200">{lead.name}</strong>
                {lead.phone ? ` (${lead.phone})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Call Type (Direction) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-primary-500" />
              <span>Call Type</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'OUTGOING', label: '📞 Outgoing' },
                { id: 'INCOMING', label: '📥 Incoming' },
                { id: 'MISSED', label: '❌ Missed / Busy' },
              ].map((t) => {
                const isSelected = callType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setCallType(t.id as any);
                      if (t.id === 'MISSED') {
                        setDuration(0);
                        setOutcome('Busy / No Answer');
                      }
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer border text-center ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Call Outcome Buttons */}
          {callType !== 'MISSED' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Call Outcome</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {outcomes.map((item) => {
                  const isSelected = outcome === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setOutcome(item.label)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Call Duration Presets */}
          {callType !== 'MISSED' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Call Duration</span>
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="7200"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 px-2 py-0.5 text-xs text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-400 font-bold">sec</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {durationPresets.map((preset) => {
                  const isSelected = duration === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setDuration(preset.value)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Call Discussion Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Call Discussion Summary & Remarks
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="e.g. Connected with client regarding requirements. Discussed quotation terms and next steps..."
              className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none placeholder:text-slate-400 leading-relaxed"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={logCallMutation.isPending}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {logCallMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Logging Call...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Save Call Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

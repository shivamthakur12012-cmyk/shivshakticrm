import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  StickyNote, X, Send, Loader2, AlertCircle, Sparkles
} from 'lucide-react';

interface QuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    _id: string;
    name: string;
    phone?: string;
    company?: string;
    leadId?: string;
  } | null;
  onSuccess?: () => void;
}

export const QuickNoteModal: React.FC<QuickNoteModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [noteContent, setNoteContent] = useState('');
  const [selectedTag, setSelectedTag] = useState('General');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quickTags = [
    'General',
    'Call Summary',
    'Requirement',
    'Pricing',
    'Follow-up Note'
  ];

  useEffect(() => {
    if (isOpen) {
      setNoteContent('');
      setSelectedTag('General');
      setErrorMsg(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const postNoteMutation = useMutation({
    mutationFn: async () => {
      if (!lead?._id) throw new Error('Lead ID is missing');
      if (!noteContent.trim()) throw new Error('Note content cannot be empty');

      const res = await api.post(`/leads/${lead._id}/notes`, {
        note: noteContent.trim(),
        tag: selectedTag
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (lead?._id) {
        queryClient.invalidateQueries({ queryKey: ['lead-detail', lead._id] });
      }
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to post note.');
    }
  });

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    postNoteMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (noteContent.trim() && !postNoteMutation.isPending) {
        postNoteMutation.mutate();
      }
    }
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
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Quick Note & Activity Log</span>
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

          {/* Quick Category Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Note Type / Tag</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {quickTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Note Description <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                rows={4}
                required
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter client discussion summary, customer requirements, remarks or key highlights..."
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none placeholder:text-slate-400 leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">Enter</kbd> to save</span>
              <span>{noteContent.length} chars</span>
            </div>
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
              disabled={postNoteMutation.isPending || !noteContent.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {postNoteMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Note...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Note</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

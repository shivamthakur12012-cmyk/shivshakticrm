import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown, ChevronRight, Check
} from 'lucide-react';

export interface SubPipelineOption {
  value: string;
  label: string;
  description?: string;
}

export interface ParentPipeline {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  accentBg: string;
  accentText: string;
  accentDot: string;
  stages: SubPipelineOption[];
}

const PARENT_PIPELINES: ParentPipeline[] = [
  {
    id: 'new',
    name: 'New Leads',
    subtitle: 'Inbound inquiries & initial intake',
    color: 'sky',
    accentBg: 'bg-sky-50 dark:bg-sky-950/60',
    accentText: 'text-sky-600 dark:text-sky-400',
    accentDot: 'bg-sky-500',
    stages: [
      { value: 'New', label: '1. New Lead' },
      { value: 'Open', label: '→ Start In Progress' },
      { value: 'Follow-up', label: '→ Schedule Follow-up' },
      { value: 'Lost', label: '✕ Mark Junk / Lost' }
    ]
  },
  {
    id: 'open',
    name: 'Open Pipeline',
    subtitle: 'Active sales & deal progression',
    color: 'amber',
    accentBg: 'bg-amber-50 dark:bg-amber-950/60',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentDot: 'bg-amber-500',
    stages: [
      { value: 'Open', label: '2. In Progress' },
      { value: 'Qualified', label: '3. Qualified' },
      { value: 'Proposal Sent', label: '4. Proposal Sent' },
      { value: 'Negotiation', label: '5. Negotiation' }
    ]
  },
  {
    id: 'followup',
    name: 'Follow-Up',
    subtitle: 'Nurturing & pending callbacks',
    color: 'purple',
    accentBg: 'bg-purple-50 dark:bg-purple-950/60',
    accentText: 'text-purple-600 dark:text-purple-400',
    accentDot: 'bg-purple-500',
    stages: [
      { value: 'Follow-up', label: '6. In Follow-up' },
      { value: 'Open', label: '→ Move to In Progress' },
      { value: 'Qualified', label: '→ Move to Qualified' },
      { value: 'Proposal Sent', label: '→ Move to Proposal Sent' },
      { value: 'Negotiation', label: '→ Move to Negotiation' }
    ]
  },
  {
    id: 'converted',
    name: 'Converted (Won)',
    subtitle: 'Closed won & customer onboarding',
    color: 'emerald',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentDot: 'bg-emerald-500',
    stages: [
      { value: 'Converted', label: '✓ Convert Lead (Won)' },
      { value: 'Open', label: '↺ Re-open to In Progress' }
    ]
  },
  {
    id: 'lost',
    name: 'Lost Leads',
    subtitle: 'Disqualified, dropped or cold',
    color: 'rose',
    accentBg: 'bg-rose-50 dark:bg-rose-950/60',
    accentText: 'text-rose-600 dark:text-rose-400',
    accentDot: 'bg-rose-500',
    stages: [
      { value: 'Lost', label: '✕ Mark as Lost' },
      { value: 'Follow-up', label: '→ Move to Follow-up' },
      { value: 'Open', label: '↺ Re-open to In Progress' }
    ]
  }
];

interface LeadStatusDropdownProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onScheduleFollowUp?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const LeadStatusDropdown: React.FC<LeadStatusDropdownProps> = ({
  currentStatus,
  onStatusChange,
  onScheduleFollowUp,
  disabled = false,
  className = '',
  size = 'sm'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; openLeft: boolean }>({
    top: 0,
    left: 0,
    openLeft: false
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<any>(null);

  // Identify which parent pipeline the current status belongs to
  const getCurrentParentPipeline = () => {
    const s = (currentStatus || '').toLowerCase();
    if (s === 'new') return 'new';
    if (s === 'open' || s === 'contacted' || s === 'qualified' || s === 'proposal sent' || s === 'negotiation') {
      return 'open';
    }
    if (s.includes('follow')) return 'followup';
    if (s === 'converted') return 'converted';
    if (s === 'lost') return 'lost';
    return 'open';
  };

  const activeParentId = getCurrentParentPipeline();

  // Get human readable status label and badge style
  const getStatusDisplay = () => {
    switch (currentStatus) {
      case 'New':
        return {
          label: '1. NEW LEAD',
          className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 hover:bg-blue-100',
          dot: 'bg-blue-500'
        };
      case 'Open':
      case 'Contacted':
        return {
          label: '2. IN PROGRESS',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 hover:bg-emerald-100',
          dot: 'bg-emerald-500'
        };
      case 'Qualified':
        return {
          label: '3. QUALIFIED',
          className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900 hover:bg-teal-100',
          dot: 'bg-teal-500'
        };
      case 'Proposal Sent':
        return {
          label: '4. PROPOSAL SENT',
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 hover:bg-indigo-100',
          dot: 'bg-indigo-500'
        };
      case 'Negotiation':
        return {
          label: '5. NEGOTIATION',
          className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900 hover:bg-orange-100',
          dot: 'bg-orange-500'
        };
      case 'Follow-up':
      case 'Follow-Up':
      case 'Followup':
        return {
          label: '6. IN FOLLOW-UP',
          className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 hover:bg-amber-100',
          dot: 'bg-amber-500'
        };
      case 'Converted':
        return {
          label: '7. CONVERTED',
          className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900 hover:bg-purple-100',
          dot: 'bg-purple-500'
        };
      case 'Lost':
        return {
          label: '8. LOST',
          className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 hover:bg-rose-100',
          dot: 'bg-rose-500'
        };
      default:
        return {
          label: currentStatus || 'SELECT STATUS',
          className: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-dark-800 dark:text-slate-300 dark:border-dark-700 hover:bg-slate-100',
          dot: 'bg-slate-400'
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Position calculation for portal
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth - rect.left;

    // Total flyout width: parent (~210px) + sub (~240px) = ~450px
    const openLeft = spaceRight < 470;

    let top = rect.bottom + 6;
    if (spaceBelow < 280 && rect.top > 280) {
      top = rect.top - 260; // open upwards if needed
    }

    setDropdownCoords({
      top: Math.max(10, top),
      left: openLeft ? Math.max(10, rect.right - 210) : Math.max(10, rect.left),
      openLeft
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    updatePosition();
    setIsOpen(true);
    setHoveredParentId(null);
  };

  const handleClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen(false);
    setHoveredParentId(null);
  };

  // Close on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const activeHoveredParent = PARENT_PIPELINES.find(p => p.id === hoveredParentId);

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button - Opens strictly on click */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={`inline-flex items-center space-x-1.5 rounded-xl font-black uppercase border transition-all duration-150 shadow-xs cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${size === 'sm' ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'
          } ${statusDisplay.className} ${className}`}
        title="Click to update lead pipeline stage"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${statusDisplay.dot} shrink-0 animate-pulse`} />
        <span className="truncate max-w-[130px]">{statusDisplay.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-slate-800 dark:text-white' : 'opacity-60'}`} />
      </button>

      {/* Cascading Flyout Menu rendered into Portal to bypass table overflow */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
              zIndex: 9999
            }}
            className="flex items-start animate-fade-in select-none"
          >
            {/* 1. Parent Pipeline Menu Container (Transparent Glassmorphism Blur) */}
            <div
              className="w-56 p-1.5 rounded-2xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/15 shadow-2xl flex flex-col space-y-1 transition-all duration-150"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.4) inset'
              }}
            >
              {/* List of Parent Pipelines Only */}
              {PARENT_PIPELINES.map((parent) => {
                const isHovered = hoveredParentId === parent.id;
                const isCurrentActive = activeParentId === parent.id;

                return (
                  <div
                    key={parent.id}
                    onMouseEnter={() => setHoveredParentId(parent.id)}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${isHovered
                      ? 'bg-white/60 dark:bg-white/20 shadow-xs text-slate-950 dark:text-white font-extrabold'
                      : isCurrentActive
                        ? 'bg-white/40 dark:bg-white/10 text-slate-900 dark:text-white font-bold'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-white/10'
                      }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-xs truncate ${isHovered ? 'text-slate-950 dark:text-white font-black' : isCurrentActive ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-200 font-semibold'}`}>
                            {parent.name}
                          </span>
                          {isCurrentActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-400/30" />
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${isHovered
                      ? 'text-slate-900 dark:text-white translate-x-0.5 font-bold'
                      : 'text-slate-400 dark:text-slate-500'
                      }`} />
                  </div>
                );
              })}
            </div>

            {/* 2. Subpipeline Flyout Menu (Appears on Hover with Transparent Glassmorphism Blur) */}
            {activeHoveredParent && (
              <div
                className={`w-64 p-2 rounded-2xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/15 shadow-2xl space-y-1 animate-fade-in ${dropdownCoords.openLeft ? 'mr-2 order-first' : 'ml-2'
                  }`}
                style={{
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.4) inset'
                }}
              >
                {/* Subpipeline Header */}
                <div className="px-2.5 py-1.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${activeHoveredParent.accentDot}`} />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      {activeHoveredParent.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                    Select Stage
                  </span>
                </div>

                {/* Subpipeline Options List */}
                <div className="space-y-0.5 pt-1">
                  {activeHoveredParent.stages.map((stage) => {
                    const isSelected = currentStatus === stage.value;

                    return (
                      <button
                        key={stage.value}
                        type="button"
                        onClick={() => {
                          if (stage.value === 'Follow-up' && onScheduleFollowUp) {
                            onScheduleFollowUp();
                          } else {
                            onStatusChange(stage.value);
                          }
                          handleClose();
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl transition-all duration-150 flex items-center justify-between group cursor-pointer ${isSelected
                          ? `${activeHoveredParent.accentBg} ${activeHoveredParent.accentText} font-black shadow-xs ring-1 ring-inset ${activeHoveredParent.color === 'sky'
                            ? 'ring-sky-400/40'
                            : activeHoveredParent.color === 'amber'
                              ? 'ring-amber-400/40'
                              : activeHoveredParent.color === 'purple'
                                ? 'ring-purple-400/40'
                                : activeHoveredParent.color === 'emerald'
                                  ? 'ring-emerald-400/40'
                                  : 'ring-rose-400/40'
                          }`
                          : 'hover:bg-white/50 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200'
                          }`}
                      >
                        <div className="flex items-start space-x-2 min-w-0 pr-2">
                          <div className="min-w-0">
                            <p className={`text-xs leading-snug truncate ${isSelected
                              ? 'font-black'
                              : 'font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white'
                              }`}>
                              {stage.label}
                            </p>
                            {stage.description && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                                {stage.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {isSelected ? (
                          <div className={`p-0.5 rounded-full ${activeHoveredParent.accentBg} shrink-0`}>
                            <Check className={`w-3.5 h-3.5 ${activeHoveredParent.accentText} stroke-[3]`} />
                          </div>
                        ) : (
                          <span className="text-[10px] opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-400 font-semibold transition-opacity shrink-0">
                            Set ↵
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

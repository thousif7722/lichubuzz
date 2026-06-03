import React from 'react';
import { AlertCircle, CheckCircle, Clock, Truck, Wrench, XCircle, DollarSign, AlertTriangle } from 'lucide-react';

// ── StatusBadge ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'bg-amber-100 text-amber-800',    icon: Clock },
  assigned:    { label: 'Assigned',    cls: 'bg-blue-100 text-blue-800',      icon: Truck },
  accepted:    { label: 'Accepted',    cls: 'bg-indigo-100 text-indigo-800',  icon: CheckCircle },
  in_progress: { label: 'In Progress', cls: 'bg-purple-100 text-purple-800',  icon: Wrench },
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-800',icon: CheckCircle },
  paid:        { label: 'Paid',        cls: 'bg-green-100 text-green-800',    icon: DollarSign },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-800',        icon: XCircle },
  disputed:    { label: 'Disputed',    cls: 'bg-orange-100 text-orange-800',  icon: AlertTriangle },
};

export function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || { label: status, cls: 'bg-slate-100 text-slate-700', icon: AlertCircle };
  const Icon = config.icon;
  const sizeClass = size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2.5 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ${config.cls} ${sizeClass}`}>
      <Icon size={size === 'lg' ? 14 : 11} />
      {config.label}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-xs mb-6">{description}</p>}
      {action}
    </div>
  );
}

// ── ConfirmModal ───────────────────────────────────────────────────────────────
export function ConfirmModal({ isOpen, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, variant = 'danger' }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={onConfirm}
            className={`flex-1 font-semibold py-2.5 rounded-xl text-sm transition-all ${
              variant === 'danger' ? 'btn-danger' : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rating Stars ───────────────────────────────────────────────────────────────
export function StarRating({ value = 0, max = 5, onChange, readonly = false, size = 'md' }) {
  const [hover, setHover] = React.useState(0);
  const starSize = size === 'lg' ? 28 : size === 'sm' ? 16 : 22;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < (hover || value);
        return (
          <span
            key={i}
            className={`cursor-${readonly ? 'default' : 'pointer'} transition-transform ${!readonly && 'hover:scale-110'}`}
            onClick={() => !readonly && onChange?.(i + 1)}
            onMouseEnter={() => !readonly && setHover(i + 1)}
            onMouseLeave={() => !readonly && setHover(0)}
            style={{ fontSize: starSize }}
          >
            {filled ? '⭐' : '☆'}
          </span>
        );
      })}
    </div>
  );
}

// ── Price Display ──────────────────────────────────────────────────────────────
export function PriceDisplay({ amount, size = 'md' }) {
  const cls = size === 'xl' ? 'text-3xl font-bold' : size === 'lg' ? 'text-xl font-bold' : 'text-base font-semibold';
  return <span className={`${cls} text-slate-900`}>₹{Number(amount).toLocaleString('en-IN')}</span>;
}

// ── Page layout wrapper ────────────────────────────────────────────────────────
export function PageLayout({ title, subtitle, action, children }) {
  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <div className="page-container">
        {(title || action) && (
          <div className="flex items-start justify-between mb-6">
            <div>
              {title && <h1 className="text-2xl font-bold text-slate-900">{title}</h1>}
              {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

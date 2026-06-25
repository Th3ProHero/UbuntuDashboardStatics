import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastLevel = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
}

// Simple module-level singleton so any component can call showToast()
let _showToast: ((message: string, level?: ToastLevel) => void) | null = null;

export function triggerToast(message: string, level: ToastLevel = 'info') {
  if (_showToast) _showToast(message, level);
}

// ─── Individual Toast item ────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    const enterTimeout = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 4s
    const exitTimeout = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 4000);

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(exitTimeout);
    };
  }, [toast.id, onRemove]);

  const colors: Record<ToastLevel, string> = {
    success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    error:   'border-red-500/50   bg-red-500/10   text-red-300',
    warning: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    info:    'border-blue-500/50  bg-blue-500/10  text-blue-300',
  };

  const icons: Record<ToastLevel, React.ReactNode> = {
    success: <CheckCircle size={16} className="shrink-0 text-emerald-400" />,
    error:   <XCircle    size={16} className="shrink-0 text-red-400" />,
    warning: <AlertTriangle size={16} className="shrink-0 text-amber-400" />,
    info:    <Info       size={16} className="shrink-0 text-blue-400" />,
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-xl
        transition-all duration-300 ease-out max-w-sm w-full
        ${colors[toast.level]}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      {icons[toast.level]}
      <p className="text-sm flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
        className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Toast Container (place once at app root) ─────────────────────────────────
let toastCounter = 0;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, level: ToastLevel = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, level }]);
  }, []);

  // Register singleton
  useEffect(() => {
    _showToast = showToast;
    return () => { _showToast = null; };
  }, [showToast]);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import type { ToastType } from '@/shared/presentation/stores/slices/ui';

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
};

const colorMap: Record<ToastType, string> = {
    success: 'var(--status-success)',
    error: 'var(--status-error)',
    warning: 'var(--status-warning)',
    info: 'var(--status-info)',
};

const ToastContainer: React.FC = () => {
    const toasts = useUIStore((s) => s.toasts);
    const removeToast = useUIStore((s) => s.removeToast);

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '1rem',
                right: '1rem',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
            }}
        >
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--glass-bg)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid var(--color-border)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            maxWidth: '350px',
                        }}
                    >
                        <span style={{ color: colorMap[toast.type] }}>
                            {iconMap[toast.type]}
                        </span>
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastContainer;

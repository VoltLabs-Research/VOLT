import { useUIStore, type ToastType, type Toast } from '@/stores/slices/ui';

export const useToast = () => {
  const addToast = useUIStore((s) => s.addToast);
  const updateToast = useUIStore((s) => s.updateToast);

  return {
    showError: (message: string, duration?: number) => addToast(message, 'error', duration),
    showSuccess: (message: string, duration?: number) => addToast(message, 'success', duration),
    showWarning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    showInfo: (message: string, duration?: number) => addToast(message, 'info', duration),
    show: (message: string, type: ToastType, duration?: number) => addToast(message, type, duration),
    update: (id: string, updates: Partial<Toast>) => updateToast(id, updates)
  };
};

export default useToast;


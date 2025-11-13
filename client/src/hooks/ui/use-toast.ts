import useToastStore, { type ToastType } from '@/stores/ui/toast';

export const useToast = () => {
  const addToast = useToastStore((s) => s.addToast);

  return {
    showError: (message: string, duration?: number) => addToast(message, 'error', duration),
    showSuccess: (message: string, duration?: number) => addToast(message, 'success', duration),
    showWarning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    showInfo: (message: string, duration?: number) => addToast(message, 'info', duration),
    show: (message: string, type: ToastType, duration?: number) => addToast(message, type, duration)
  };
};

export default useToast;

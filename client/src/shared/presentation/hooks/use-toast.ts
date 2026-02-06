import { toast } from 'sonner';

const useToast = () => {
    const showSuccess = (message: string) => {
        toast.success(message);
    };

    const showError = (message: string) => {
        toast.error(message);
    };

    const showInfo = (message: string) => {
        toast.info(message);
    };

    const showWarning = (message: string) => {
        toast.warning(message);
    };

    return { showSuccess, showError, showInfo, showWarning };
};

export default useToast;

import { useCallback } from 'react';

interface UseConfirmOptions {
    title?: string;
    message?: string;
}

const useConfirm = () => {
    const confirm = useCallback(async (message: string): Promise<boolean> => {
        return window.confirm(message);
    }, []);

    const confirmDelete = useCallback(async (itemName: string, options?: UseConfirmOptions): Promise<boolean> => {
        const message = options?.message || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
        return window.confirm(message);
    }, []);

    return {
        confirm,
        confirmDelete
    };
};

export default useConfirm;

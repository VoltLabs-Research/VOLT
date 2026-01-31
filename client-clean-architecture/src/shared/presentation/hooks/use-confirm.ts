import { useCallback } from 'react';

/**
 * Hook for showing confirmation dialogs with consistent UX.
 * Provides a simple wrapper around window.confirm.
 */
const useConfirm = () => {
    const confirm = useCallback(async (message: string): Promise<boolean> => {
        return window.confirm(message);
    }, []);

    const confirmDelete = useCallback(async (itemName: string, customMessage?: string): Promise<boolean> => {
        const message = customMessage || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
        return window.confirm(message);
    }, []);

    return { confirm, confirmDelete };
};

export default useConfirm;

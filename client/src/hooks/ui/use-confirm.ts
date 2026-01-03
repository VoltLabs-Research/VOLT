import { useCallback } from 'react';

interface UseConfirmOptions {
    /**
     * Title for the confirmation dialog
     */
    title?: string;

    /**
     * Custom confirmation message
     */
    message?: string;
}

/**
 * Hook for showing confirmation dialogs with consistent UX.
 * Provides a simple wrapper around window.confirm with better DX.
 */
const useConfirm = () => {
    const confirm = useCallback(async (message: string): Promise<boolean> => {
        return window.confirm(message);
    }, []);

    /**
     * Convenience method for delete confirmations with consistent messaging
     */
    const confirmDelete = useCallback(async (
        itemName: string,
        options?: UseConfirmOptions
    ): Promise<boolean> => {
        const message = options?.message ||
            `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
        return window.confirm(message);
    }, []);

    return {
        confirm,
        confirmDelete
    };
};

export default useConfirm;

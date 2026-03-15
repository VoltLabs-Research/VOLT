import { useExportPluginMutation } from './queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';
import { isAccessDeniedError } from '@/shared/errors/core';

const useExportPlugin = () => {
    const exportPluginMutationResult = useExportPluginMutation();

    const exportPlugin = useCallback(async (id: string, filename: string): Promise<void> => {
        try {
            await showPromise(
                async () => {
                    const blob = await exportPluginMutationResult.mutateAsync({ _id: id });
                    triggerBrowserDownload(blob, filename);
                },
                {
                    loading: { title: 'Exporting plugin...' },
                    success: { title: 'Plugin exported successfully' },
                    error: { title: 'Failed to export plugin' }
                }
            );
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
        }
    }, [exportPluginMutationResult]);

    return exportPlugin;
};

export default useExportPlugin;

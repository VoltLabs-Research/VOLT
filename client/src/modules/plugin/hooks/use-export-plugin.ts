import { useCallback } from 'react';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useExportPluginMutation } from './plugin/queries';
import ApiError from '@/shared/errors/ApiError';

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
            if (ApiError.isRBACError(error)) return;
        }
    }, [exportPluginMutationResult]);

    return exportPlugin;
};

export default useExportPlugin;

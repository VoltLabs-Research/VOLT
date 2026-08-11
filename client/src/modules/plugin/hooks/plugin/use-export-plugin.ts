import { useExportPluginMutation } from './queries';
import { showPromise } from '@/shared/ui/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';

const useExportPlugin = () => {
    const exportPluginMutationResult = useExportPluginMutation();

    const exportPlugin = useCallback(async (id: string, filename: string): Promise<void> => {
        try {
            await showPromise(
                async () => {
                    const blob = await exportPluginMutationResult.mutateAsync({ pluginId: id });
                    triggerBrowserDownload(blob, filename);
                },
                {
                    loading: { title: 'Exporting plugin...' },
                    success: { title: 'Plugin exported successfully' },
                    error: { title: 'Failed to export plugin' }
                }
            );
        } catch {
            // showPromise already surfaced the failure as a toast.
        }
    }, [exportPluginMutationResult]);

    return exportPlugin;
};

export default useExportPlugin;

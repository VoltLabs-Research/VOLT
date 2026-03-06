import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-services';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import ApiError from '@/shared/errors/ApiError';

const useExportPlugin = () => {
    const { pluginRepository } = usePluginUseCases();

    const exportPlugin = useCallback(async (id: string, filename: string): Promise<void> => {
        try{
            await showPromise(
                async () => {
                    const blob = await pluginRepository.exportPlugin(id);
                    triggerBrowserDownload(blob, filename);
                },
                {
                    loading: { title: 'Exporting plugin...' },
                    success: { title: 'Plugin exported successfully' },
                    error: { title: 'Failed to export plugin' }
                }
            );
        }catch(error: unknown){
            if(ApiError.isRBACError(error)) return;
        }
    }, [pluginRepository]);

    return exportPlugin;
};

export default useExportPlugin;

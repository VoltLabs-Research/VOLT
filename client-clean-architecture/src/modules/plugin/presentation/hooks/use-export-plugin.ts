import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';

const useExportPlugin = () => {
    const { pluginRepository } = usePluginUseCases();

    const exportPlugin = useCallback(async (id: string, filename: string): Promise<void> => {
        const blob = await pluginRepository.exportPlugin(id);
        triggerBrowserDownload(blob, filename);
    }, [pluginRepository]);

    return exportPlugin;
};

export default useExportPlugin;

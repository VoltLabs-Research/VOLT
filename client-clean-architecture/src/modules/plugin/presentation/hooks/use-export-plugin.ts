import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';

const useExportPlugin = () => {
    const { pluginRepository } = usePluginUseCases();

    const exportPlugin = useCallback(async (id: string, filename: string): Promise<void> => {
        const blob = await pluginRepository.exportPlugin(id);
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }, [pluginRepository]);

    return exportPlugin;
};

export default useExportPlugin;

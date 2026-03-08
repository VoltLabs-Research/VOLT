import { useImportPluginMutation } from './queries';
import { useCallback } from 'react';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';

const useImportPlugin = () => {
    const importPluginMutationResult = useImportPluginMutation();

    const importPlugin = useCallback(async (file: File): Promise<Plugin> => {
        return await importPluginMutationResult.mutateAsync({ file });
    }, [importPluginMutationResult]);

    return importPlugin;
};

export default useImportPlugin;

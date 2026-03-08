import { useCallback } from 'react';
import { useImportPluginMutation } from './plugin/queries';
import type { Plugin } from '../api/entities/plugin';

const useImportPlugin = () => {
    const importPluginMutationResult = useImportPluginMutation();

    const importPlugin = useCallback(async (file: File): Promise<Plugin> => {
        return await importPluginMutationResult.mutateAsync({ file });
    }, [importPluginMutationResult]);

    return importPlugin;
};

export default useImportPlugin;

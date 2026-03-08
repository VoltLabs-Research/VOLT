import { useCallback } from 'react';
import { useDeletePluginMutation } from './plugin/queries';

const useDeletePlugin = () => {
    const deletePluginMutationResult = useDeletePluginMutation();

    return useCallback(async (id: string): Promise<void> => {
        await deletePluginMutationResult.mutateAsync({ _id: id });
    }, [deletePluginMutationResult]);
};

export default useDeletePlugin;

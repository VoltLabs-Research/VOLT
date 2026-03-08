import { useDeletePluginMutation } from './queries';
import { useCallback } from 'react';

const useDeletePlugin = () => {
    const deletePluginMutationResult = useDeletePluginMutation();

    return useCallback(async (id: string): Promise<void> => {
        await deletePluginMutationResult.mutateAsync({ _id: id });
    }, [deletePluginMutationResult]);
};

export default useDeletePlugin;

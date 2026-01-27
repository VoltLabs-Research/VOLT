import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trajectoryQueryKeys } from './use-trajectory-queries';
import { getTrajectoryUseCases } from '../../application/registry';

export const useTrajectoryUpdates = () => {
    const queryClient = useQueryClient();
    const { trajectoryUpdatesSocketUseCase } = getTrajectoryUseCases();

    useEffect(() => {
        const unsubscribeUpdated = trajectoryUpdatesSocketUseCase.onUpdated((data: any) => {
            const { trajectoryId } = data;
            
            // Invalidate specific trajectory detail
            queryClient.invalidateQueries({
                queryKey: trajectoryQueryKeys.detail(trajectoryId)
            });
            
            // Also invalidate lists to ensure consistency
            queryClient.invalidateQueries({
                queryKey: trajectoryQueryKeys.lists()
            });
        });

        const unsubscribeCreated = trajectoryUpdatesSocketUseCase.onCreated(() => {
            queryClient.invalidateQueries({
                queryKey: trajectoryQueryKeys.lists()
            });
        });

        const unsubscribeDeleted = trajectoryUpdatesSocketUseCase.onDeleted(() => {
             queryClient.invalidateQueries({
                queryKey: trajectoryQueryKeys.lists()
            });
        });

        return () => {
            if (typeof unsubscribeUpdated === 'function') unsubscribeUpdated();
            if (typeof unsubscribeCreated === 'function') unsubscribeCreated();
            if (typeof unsubscribeDeleted === 'function') unsubscribeDeleted();
        };
    }, [queryClient, trajectoryUpdatesSocketUseCase]);
};

export default useTrajectoryUpdates;

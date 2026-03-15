import rasterService from '@/modules/raster/api/service';
import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useMutation } from '@tanstack/react-query';
import type {
    GetRasterMetadataParams,
    TriggerRasterizationParams,
    TriggerRasterizationResponse
} from '@/modules/raster/api/dtos';

const BASE_KEY = 'raster';

const KEYS = buildKeys<{
    metadata: GetRasterMetadataParams;
}>(BASE_KEY);

const markRasterizationRequestInFlight = (trajectoryId: string): void => {
    const currentIds = useTeamJobsStore.getState().inFlightRasterTrajectoryIds;
    if (currentIds.has(trajectoryId)) {
        throw new Error('Equivalent rasterization jobs are already queued or running for this trajectory');
    }

    const nextIds = new Set(currentIds);
    nextIds.add(trajectoryId);
    useTeamJobsStore.getState().setInFlightRasterTrajectoryIds(nextIds);
};

const clearRasterizationRequestInFlight = (trajectoryId: string): void => {
    const currentIds = useTeamJobsStore.getState().inFlightRasterTrajectoryIds;
    if (!currentIds.has(trajectoryId)) {
        return;
    }

    const nextIds = new Set(currentIds);
    nextIds.delete(trajectoryId);
    useTeamJobsStore.getState().setInFlightRasterTrajectoryIds(nextIds);
};

export const rasterMetadataQuery = createQuery(KEYS.metadata, rasterService.getMetadata);

export const useTriggerRasterizationMutation = () => {
    return useMutation<TriggerRasterizationResponse, Error, TriggerRasterizationParams>({
        mutationFn: async (variables) => {
            markRasterizationRequestInFlight(variables.trajectoryId);

            try {
                return await rasterService.triggerRasterization(variables);
            } catch (error) {
                clearRasterizationRequestInFlight(variables.trajectoryId);
                throw error;
            }
        },
        onSuccess: async (_data, variables) => {
            clearRasterizationRequestInFlight(variables.trajectoryId);

            await Promise.all([
                rasterMetadataQuery.invalidate({ trajectoryId: variables.trajectoryId }),
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() }),
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() }),
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectory(variables.trajectoryId) })
            ]);
        },
        onError: (_error, variables) => {
            clearRasterizationRequestInFlight(variables.trajectoryId);
        }
    });
};

export const RASTER_QUERY_KEYS = {
    metadata: KEYS.metadata
} as const;

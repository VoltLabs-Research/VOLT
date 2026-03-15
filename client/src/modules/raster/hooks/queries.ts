import rasterService from '@/modules/raster/api/service';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import { buildKeys, createManagedMutation, createQuery } from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import type {
    GetRasterMetadataParams,
    TriggerRasterizationParams,
    TriggerRasterizationResponse
} from '@/modules/raster/api/dtos';

const BASE_KEY = 'raster';

const KEYS = buildKeys<{
    metadata: GetRasterMetadataParams;
}>(BASE_KEY);

export const rasterMetadataQuery = createQuery(KEYS.metadata, rasterService.getMetadata);

export const useTriggerRasterizationMutation = createManagedMutation<
    TriggerRasterizationResponse,
    TriggerRasterizationParams
>(rasterService.triggerRasterization, async (_data, variables) => {
    await Promise.all([
        rasterMetadataQuery.invalidate({ trajectoryId: variables.trajectoryId }),
        queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() }),
        queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() }),
        queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectory(variables.trajectoryId) })
    ]);
});

export const RASTER_QUERY_KEYS = {
    metadata: KEYS.metadata
} as const;

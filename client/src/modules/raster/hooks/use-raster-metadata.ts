import { rasterMetadataQuery } from '@/modules/raster/hooks/queries';
import type { RasterMetadata } from '@/modules/raster/api/entities/raster';
import type { ApiError } from '@voltstack/voltclient';

interface UseRasterMetadataParams {
    trajectoryId?: string;
    enabled?: boolean;
};

interface UseRasterMetadataResult {
    metadata: RasterMetadata | null;
    isLoading: boolean;
    error: ApiError | Error | null;
    isRasterMissing: boolean;
    refetch: () => Promise<unknown>;
};

export const useRasterMetadata = ({ trajectoryId, enabled = true }: UseRasterMetadataParams): UseRasterMetadataResult => {
    const query = rasterMetadataQuery(
        { trajectoryId: trajectoryId || '' },
        {
            enabled: enabled && Boolean(trajectoryId)
        }
    );

    return {
        metadata: query.data?.metadata ?? null,
        isLoading: query.isLoading,
        error: query.error,
        isRasterMissing: !query.isLoading && !query.error && !query.data?.metadata,
        refetch: query.refetch
    };
};

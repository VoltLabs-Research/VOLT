import { useEffect, useMemo } from 'react';
import useTrajectoryStore from '@/stores/trajectories';
import type { RasterQuery } from '@/types/raster';

export const useRasterizedFrames = (trajectoryId?: string, query?: RasterQuery & { force?: boolean }) => {
  const getRasterizedFrames = useTrajectoryStore((s) => s.getRasterizedFrames);
  const rasterCache = useTrajectoryStore((s) => s.rasterCache);
  const urlCache = useTrajectoryStore((s) => s.rasterObjectUrlCache);
  const isRasterLoading = useTrajectoryStore((s) => s.isRasterLoading);

  useEffect(() => {
        if(!trajectoryId) return;
        getRasterizedFrames(trajectoryId, query);
    }, [trajectoryId, query?.offset, query?.limit, query?.match, query?.force]);

    const page = trajectoryId ? rasterCache[trajectoryId] : undefined;
    const urls = trajectoryId ? urlCache[trajectoryId] : undefined;

    const itemsWithSrc = useMemo(() => {
        const items = page?.items ?? [];
        return items.map((it) => ({
        ...it,
        src: urls?.[it.filename] ?? null,
        }));
    }, [page?.items, urls]);

    return {
        page,
        items: itemsWithSrc,
        loading: isRasterLoading && !page,
        refreshing: isRasterLoading && !!page, 
    };
}

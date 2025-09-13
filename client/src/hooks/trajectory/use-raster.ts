import { useEffect, useMemo } from 'react';
import useRasterStore from '@/stores/raster';

export const useRasterizedFrames = (trajectoryId?: string) => {
    const getRasterFrames = useRasterStore((state) => state.getRasterFrames);
    const trajectory = useRasterStore((state) => state.trajectory);
    const rasterData = useRasterStore((state) => state.rasterData);
    const isLoading = useRasterStore((state) => state.isLoading);
    const error = useRasterStore((state) => state.error);

    useEffect(() => {
        if(!trajectoryId) return;

        getRasterFrames(trajectoryId);
    }, [trajectoryId, getRasterFrames]);

    const itemsWithSrc = useMemo(() => {
        const items = rasterData?.items ?? [];
        const itemUrls = rasterData?.itemUrls ?? {};
        
        return items.map((item) => ({
            ...item,
            src: itemUrls[item.filename] ?? null,
        }));
    }, [rasterData?.items, rasterData?.itemUrls]);

    const byFrameWithSrc = useMemo(() => {
        if(!rasterData?.byFrame || !rasterData?.byFrameUrls) return {};
        
        const result: Record<number, any[]> = {};
        
        Object.keys(rasterData.byFrame).forEach(frameKey => {
            const frame = parseInt(frameKey, 10);
            const analyses = rasterData.byFrame[frame] || [];
            const frameUrls = rasterData.byFrameUrls[frame] || {};
            
            result[frame] = analyses.map(analysis => ({
                ...analysis,
                src: frameUrls[analysis.filename] ?? null
            }));
        });
        
        return result;
    }, [rasterData?.byFrame, rasterData?.byFrameUrls]);

    return {
        items: itemsWithSrc,
        byFrame: byFrameWithSrc,
        trajectory,
        
        loading: isLoading && !rasterData,
        error,
        
        hasData: !!rasterData && rasterData.items.length > 0,
        totalFrames: Object.keys(rasterData?.byFrame ?? {}).length,
    };
};
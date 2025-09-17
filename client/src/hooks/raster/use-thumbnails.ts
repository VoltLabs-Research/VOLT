import { useMemo } from 'react';
import type { Scene } from '@/types/raster';

interface UseThumbnailsResult {
  getThumbnailScene: (timestep: number) => Scene | null;
}

export const useThumbnails = (
  trajectoryId: string | undefined,
  selectedAnalysisLeft: string | null,
  selectedModelLeft: string
): UseThumbnailsResult => {
  
  const getThumbnailScene = useMemo(() => {
    return (timestep: number): Scene | null => {
      if (!trajectoryId || !selectedAnalysisLeft) return null;
      
      return {
        frame: timestep,
        model: selectedModelLeft,
        analysisId: selectedAnalysisLeft,
        isLoading: true
      };
    };
  }, [trajectoryId, selectedAnalysisLeft, selectedModelLeft]);

  return { getThumbnailScene };
};

export default useThumbnails;

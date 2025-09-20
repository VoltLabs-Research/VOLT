import { useEffect, useState } from 'react';
import useRasterStore from '@/stores/raster';

export interface UseRasterFrameResult {
  scene: {
    frame: number;
    model: string;
    analysisId: string;
    data?: string;
    isUnavailable?: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Simplified, race-safe wrapper:
 * - Validates inputs
 * - Re-uses store's getRasterFrame
 * - Marks unavailable frames
 * - Accepts an optional 5th `priority` arg (kept for compatibility; currently informational)
 */
export default function useRasterFrame(
  trajectoryId?: string,
  timestep?: number,
  analysisId?: string,
  model?: string,
  _priority?: 'high' | 'low' // accepted but unused here; store handles prioritization
): UseRasterFrameResult {
  const [scene, setScene] = useState<UseRasterFrameResult['scene']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!trajectoryId || timestep === undefined || !analysisId || !model) {
      setScene(null);
      setError('Missing required parameters');
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    const run = async () => {
      setIsLoading(true);
      try {
        const { getRasterFrame } = useRasterStore.getState();
        const data = await getRasterFrame(trajectoryId, timestep, analysisId, model);

        if (!mounted) return;
        if (data) {
          setScene({ frame: timestep, model, analysisId, data, isUnavailable: false });
          setError(null);
        } else {
          setScene({ frame: timestep, model, analysisId, isUnavailable: true });
          setError(`Frame ${timestep} not available`);
        }
      } catch (e: any) {
        if (!mounted) return;
        setScene({ frame: timestep, model, analysisId, isUnavailable: true });
        setError(e?.message ?? 'Unknown error loading frame');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [trajectoryId, timestep, analysisId, model]);

  return { scene, isLoading, error };
}

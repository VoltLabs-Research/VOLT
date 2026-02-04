import { useEffect, useState } from 'react';
import { useRasterStore } from '@/features/raster/stores';

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
};

const useRasterFrame = (
    trajectoryId?: string,
    timestep?: number,
    analysisId?: string,
    model?: string
): UseRasterFrameResult => {
    const [scene, setScene] = useState<UseRasterFrameResult['scene']>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const getRasterFrame = useRasterStore((state) => state.getRasterFrame);

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
                const data = await getRasterFrame(trajectoryId, timestep, analysisId, model);
                if (!mounted) return;

                if (data) {
                    setScene({
                        frame: timestep,
                        model,
                        analysisId,
                        data,
                        isUnavailable: false
                    });
                    setError(null);
                } else {
                    setScene({
                        frame: timestep,
                        model,
                        analysisId,
                        isUnavailable: true
                    });
                    setError(`Frame ${timestep} not available`);
                }
            } catch (e: any) {
                if (!mounted) return;
                // Silently handle 404s for missing frames - this is expected
                setScene({
                    frame: timestep,
                    model,
                    analysisId,
                    isUnavailable: true
                });
                setError(e?.message ?? 'Frame not available');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        run();
        return () => {
            mounted = false;
        };
    }, [trajectoryId, timestep, analysisId, model]);

    return { scene, isLoading, error };
};

export default useRasterFrame;

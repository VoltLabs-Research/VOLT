import { useCallback, useEffect, useRef, useState } from 'react';
import useSceneArtifactUseCases from '@/modules/trajectory/presentation/hooks/generated-scenes/use-scene-artifact-use-cases';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { RenderableExposure } from '@/modules/plugin/presentation/stores/use-plugin-store';
import type { RenderableExposurePayload } from '@/modules/trajectory/application/dtos/scene-artifacts';

export type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ExposureEntry {
    state: ExposureLoadState;
    exposures: RenderableExposure[];
    error?: unknown;
}

export const DEFAULT_ENTRY: ExposureEntry = { state: 'idle', exposures: [] };

interface UseExposureManagerProps {
    trajectoryId?: string;
}

interface UseExposureManagerReturn {
    exposureEntries: Map<string, ExposureEntry>;
    getEntry: (analysisId: string) => ExposureEntry;
    loadExposuresForAnalysis: (analysisId: string) => Promise<void>;
    resetEntries: () => void;
}

const useExposureManager = ({ trajectoryId }: UseExposureManagerProps): UseExposureManagerReturn => {
    const { listSceneArtifactsUseCase } = useSceneArtifactUseCases();
    const { checkRBACError } = useAccessDenied();
    const [exposureEntries, setExposureEntries] = useState<Map<string, ExposureEntry>>(new Map());
    const exposureEntriesRef = useRef(exposureEntries);

    // Keep ref in sync
    useEffect(() => {
        exposureEntriesRef.current = exposureEntries;
    }, [exposureEntries]);

    const getEntry = useCallback((analysisId: string): ExposureEntry => {
        return exposureEntriesRef.current.get(analysisId) ?? DEFAULT_ENTRY;
    }, []);

    const setEntry = useCallback((analysisId: string, next: ExposureEntry) => {
        setExposureEntries(prev => {
            const map = new Map(prev);
            map.set(analysisId, next);
            return map;
        });
    }, []);

    const resetEntries = useCallback(() => {
        setExposureEntries(new Map());
    }, []);

    const loadExposuresForAnalysis = useCallback(async (analysisId: string) => {
        if (!trajectoryId) return;

        const current = exposureEntriesRef.current.get(analysisId) ?? DEFAULT_ENTRY;
        if (current.state === 'loading' || current.state === 'loaded') return;

        setEntry(analysisId, { state: 'loading', exposures: [] });

        try {
            const response = await listSceneArtifactsUseCase.execute({
                trajectoryId,
                analysisId,
                sourceType: 'plugin-exposure',
                projection: 'renderable-exposures',
                page: 1,
                limit: 1000
            });

            const exposures = response.data as RenderableExposurePayload[];

            setEntry(analysisId, { state: 'loaded', exposures: exposures as RenderableExposure[] });
        } catch (error) {
            if(checkRBACError(error)) return;
            sileo.error({ title: 'Failed to load exposures' });
            setEntry(analysisId, { state: 'error', exposures: [], error });
        }
    }, [trajectoryId, listSceneArtifactsUseCase, setEntry]);

    return {
        exposureEntries,
        getEntry,
        loadExposuresForAnalysis,
        resetEntries
    };
};

export default useExposureManager;

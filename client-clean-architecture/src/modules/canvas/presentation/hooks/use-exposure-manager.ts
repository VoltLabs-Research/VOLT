import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import usePluginStore, { type RenderableExposure } from '@/modules/plugin/presentation/stores/use-plugin-store';

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
    loadExposuresForAnalysis: (analysisId: string, pluginSlug: string) => Promise<void>;
    resetEntries: () => void;
}

const useExposureManager = ({ trajectoryId }: UseExposureManagerProps): UseExposureManagerReturn => {
    const [exposureEntries, setExposureEntries] = useState<Map<string, ExposureEntry>>(new Map());
    const exposureEntriesRef = useRef(exposureEntries);

    const { getRenderableExposures, pluginsBySlug } = usePluginStore(useShallow((s) => ({
        getRenderableExposures: s.getRenderableExposures,
        pluginsBySlug: s.pluginsBySlug
    })));

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

    const loadExposuresForAnalysis = useCallback(async (analysisId: string, pluginSlug: string) => {
        if (!trajectoryId) return;

        const current = exposureEntriesRef.current.get(analysisId) ?? DEFAULT_ENTRY;
        if (current.state === 'loading' || current.state === 'loaded') return;

        if (!pluginsBySlug[pluginSlug]) return;

        setEntry(analysisId, { state: 'loading', exposures: [] });

        try {
            const exposures = await getRenderableExposures(trajectoryId, analysisId, 'canvas', pluginSlug);
            setEntry(analysisId, { state: 'loaded', exposures });
        } catch (error) {
            console.error('[useExposureManager] fetch failed', analysisId, error);
            setEntry(analysisId, { state: 'error', exposures: [], error });
        }
    }, [trajectoryId, getRenderableExposures, pluginsBySlug, setEntry]);

    return {
        exposureEntries,
        getEntry,
        loadExposuresForAnalysis,
        resetEntries
    };
};

export default useExposureManager;

import { applySearchParamUpdates } from '@/shared/ui/hooks/use-search-params';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export enum CanvasWorkspace {
    Scene = 'scene',
    Raster = 'raster'
}

interface UpdateOptions {
    replace?: boolean;
}

const resolveCanvasWorkspace = (workspace: string | null): CanvasWorkspace => {
    if (workspace === CanvasWorkspace.Raster) {
        return CanvasWorkspace.Raster;
    }

    return CanvasWorkspace.Scene;
};

const parseNumberParam = (value: string | null): number | undefined => {
    if (value === null) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const useCanvasUrlState = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const analysisId = searchParams.get('analysisId') || undefined;
    const resultsPluginId = searchParams.get('results') || undefined;
    const timelineExposureId = searchParams.get('timelineExposure') || undefined;
    const settingsKey = searchParams.get('settings') || undefined;
    const selectedNotebookId = searchParams.get('notebook') || undefined;
    const requestedTimestep = parseNumberParam(searchParams.get('timestep'));
    const showWidgets = searchParams.get('widgets') !== 'false';
    const showGrid = searchParams.get('grid') === 'true';
    const showGizmo = searchParams.get('gizmo') !== 'false';
    const activeWorkspace = resolveCanvasWorkspace(searchParams.get('workspace'));

    const updateSearchParams = useCallback((updates: Record<string, string | number | boolean | null | undefined>, options?: UpdateOptions) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, updates), {
            replace: options?.replace ?? false
        });
    }, [setSearchParams]);

    const setAnalysisId = useCallback((id?: string, options?: UpdateOptions) => {
        updateSearchParams({ analysisId: id ?? null }, options);
    }, [updateSearchParams]);

    const setResultsPluginId = useCallback((pluginId?: string, options?: UpdateOptions) => {
        updateSearchParams({ results: pluginId ?? null }, options);
    }, [updateSearchParams]);

    const setTimelineExposureId = useCallback((exposureId?: string, options?: UpdateOptions) => {
        updateSearchParams({ timelineExposure: exposureId ?? null }, options);
    }, [updateSearchParams]);

    const setSelectedNotebookId = useCallback((value?: string | null, options?: UpdateOptions) => {
        updateSearchParams({ notebook: value ?? null }, options);
    }, [updateSearchParams]);

    const setActiveWorkspace = useCallback((id: CanvasWorkspace, options?: UpdateOptions) => {
        updateSearchParams({ workspace: id === CanvasWorkspace.Scene ? null : id }, options);
    }, [updateSearchParams]);

    return {
        searchParams,
        updateSearchParams,
        analysisId,
        resultsPluginId,
        timelineExposureId,
        settingsKey,
        selectedNotebookId,
        requestedTimestep,
        showWidgets,
        showGrid,
        showGizmo,
        activeWorkspace,
        setAnalysisId,
        setResultsPluginId,
        setTimelineExposureId,
        setSelectedNotebookId,
        setActiveWorkspace
    };
};

export default useCanvasUrlState;

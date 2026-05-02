import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export enum CanvasWorkspace {
    Scene = 'scene',
    Raster = 'raster',
    Scripting = 'scripting'
}

interface UpdateOptions {
    replace?: boolean;
}

const CANVAS_WORKSPACES = new Set<string>(Object.values(CanvasWorkspace));

const resolveCanvasWorkspace = (workspace: string | null): CanvasWorkspace => {
    if (workspace === CanvasWorkspace.Raster) {
        return CanvasWorkspace.Raster;
    }

    if (workspace === CanvasWorkspace.Scripting) {
        return CanvasWorkspace.Scripting;
    }

    return CanvasWorkspace.Scene;
};

const useCanvasUrlState = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        selectedIds: activeModifiers,
        toggleSelection,
        isSelected
    } = useSelectionParams({ paramName: 'modifiers' });

    const analysisId = searchParams.get('analysisId') || undefined;
    const resultsPluginId = searchParams.get('results') || undefined;
    const timelineExposureId = searchParams.get('timelineExposure') || undefined;
    const pluginParam = searchParams.get('plugin') || undefined;
    const settingsKey = searchParams.get('settings') || undefined;
    const selectedNotebookId = searchParams.get('notebook') || undefined;
    const rasterModel = searchParams.get('rasterModel') || undefined;
    const showWidgets = searchParams.get('widgets') !== 'false';
    const showGrid = searchParams.get('grid') === 'true';
    const showGizmo = searchParams.get('gizmo') !== 'false';
    const renderConfigOpen = searchParams.get('renderConfig') === 'true';
    const requestedWorkspace = searchParams.get('workspace');
    const activeWorkspace = CANVAS_WORKSPACES.has(requestedWorkspace ?? '')
        ? resolveCanvasWorkspace(requestedWorkspace)
        : CanvasWorkspace.Scene;

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

    const setPluginParam = useCallback((value?: string | null, options?: UpdateOptions) => {
        updateSearchParams({ plugin: value ?? null }, options);
    }, [updateSearchParams]);

    const setSettingsKey = useCallback((value?: string | null, options?: UpdateOptions) => {
        updateSearchParams({ settings: value ?? null }, options);
    }, [updateSearchParams]);

    const setSelectedNotebookId = useCallback((value?: string | null, options?: UpdateOptions) => {
        updateSearchParams({ notebook: value ?? null }, options);
    }, [updateSearchParams]);

    const setRasterModel = useCallback((value?: string | null, options?: UpdateOptions) => {
        updateSearchParams({ rasterModel: value ?? null }, options);
    }, [updateSearchParams]);

    const setRenderConfigOpen = useCallback((open: boolean, options?: UpdateOptions) => {
        updateSearchParams({ renderConfig: open ? 'true' : null }, options);
    }, [updateSearchParams]);

    const setActiveWorkspace = useCallback((id: CanvasWorkspace, options?: UpdateOptions) => {
        updateSearchParams({ workspace: id === CanvasWorkspace.Scene ? null : id }, options);
    }, [updateSearchParams]);

    const setModifiers = useCallback((ids: string[], options?: UpdateOptions) => {
        updateSearchParams({ modifiers: ids.length ? ids.join(',') : null }, options);
    }, [updateSearchParams]);

    const toggleModifier = useCallback((id: string) => {
        toggleSelection(id);
    }, [toggleSelection]);

    const isModifierSelected = useCallback((id: string) => {
        return isSelected(id);
    }, [isSelected]);

    const pluginSelection = useMemo(() => {
        if (!pluginParam) return null;
        const [pluginId, pluginModifierId] = pluginParam.split(':');
        return { pluginId, pluginModifierId };
    }, [pluginParam]);

    return {
        searchParams,
        updateSearchParams,
        analysisId,
        resultsPluginId,
        timelineExposureId,
        pluginParam,
        pluginSelection,
        settingsKey,
        selectedNotebookId,
        rasterModel,
        showWidgets,
        showGrid,
        showGizmo,
        renderConfigOpen,
        activeModifiers,
        activeWorkspace,
        toggleModifier,
        isModifierSelected,
        setAnalysisId,
        setResultsPluginId,
        setTimelineExposureId,
        setPluginParam,
        setSettingsKey,
        setSelectedNotebookId,
        setRasterModel,
        setRenderConfigOpen,
        setActiveWorkspace,
        setModifiers
    };
};

export default useCanvasUrlState;

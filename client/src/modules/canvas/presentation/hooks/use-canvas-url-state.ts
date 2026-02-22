import { useCallback, useEffect, useMemo } from 'react';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';

interface UpdateOptions {
    replace?: boolean;
}

interface CanvasUrlStateOptions {
    trajectory?: { analysis?: Array<{ _id?: string }> } | null;
}

const useCanvasUrlState = (options?: CanvasUrlStateOptions) => {
    const { searchParams, updateSearchParams } = useSearchParamsState();
    const {
        selectedIds: activeModifiers,
        toggleSelection,
        isSelected
    } = useSelectionParams({ paramName: 'modifiers' });

    const analysisId = searchParams.get('analysis') || undefined;
    const resultsPluginId = searchParams.get('results') || undefined;
    const timelineExposureId = searchParams.get('timelineExposure') || undefined;
    const pluginParam = searchParams.get('plugin') || undefined;
    const settingsKey = searchParams.get('settings') || undefined;
    const showWidgets = searchParams.get('widgets') !== 'false';
    const showGrid = searchParams.get('grid') !== 'false';
    const renderConfigOpen = searchParams.get('renderConfig') === 'true';
    const activeWorkspace = searchParams.get('workspace') || 'modeling';

    const setAnalysisId = useCallback((id?: string, options?: UpdateOptions) => {
        updateSearchParams({ analysis: id ?? null }, options);
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

    const setRenderConfigOpen = useCallback((open: boolean, options?: UpdateOptions) => {
        updateSearchParams({ renderConfig: open ? 'true' : null }, options);
    }, [updateSearchParams]);

    const setActiveWorkspace = useCallback((id: string, options?: UpdateOptions) => {
        updateSearchParams({ workspace: id === 'modeling' ? null : id }, options);
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

    const trajectory = options?.trajectory;

    useEffect(() => {
        if (!trajectory?.analysis?.length || analysisId) return;
        const latest = trajectory.analysis[trajectory.analysis.length - 1];
        if (!latest?._id) return;
        setAnalysisId(latest._id, { replace: true });
    }, [trajectory, analysisId, setAnalysisId]);

    return {
        searchParams,
        updateSearchParams,
        analysisId,
        resultsPluginId,
        timelineExposureId,
        pluginParam,
        pluginSelection,
        settingsKey,
        showWidgets,
        showGrid,
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
        setRenderConfigOpen,
        setActiveWorkspace,
        setModifiers
    };
};

export default useCanvasUrlState;

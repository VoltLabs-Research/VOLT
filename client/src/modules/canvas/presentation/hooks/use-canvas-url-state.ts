import { useCallback, useMemo } from 'react';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';

interface UpdateOptions {
    replace?: boolean;
}

const useCanvasUrlState = () => {
    const { searchParams, updateSearchParams, setParam, removeParam } = useSearchParamsState();
    const {
        selectedIds: activeModifiers,
        toggleSelection,
        isSelected
    } = useSelectionParams({ paramName: 'modifiers' });

    const analysisId = searchParams.get('analysis') || undefined;
    const resultsSlug = searchParams.get('results') || undefined;
    const pluginParam = searchParams.get('plugin') || undefined;
    const settingsKey = searchParams.get('settings') || undefined;
    const showWidgets = searchParams.get('widgets') !== 'false';
    const showGrid = searchParams.get('grid') !== 'false';
    const renderConfigOpen = searchParams.get('renderConfig') === 'true';

    const setAnalysisId = useCallback((id?: string, options?: UpdateOptions) => {
        updateSearchParams({ analysis: id ?? null }, options);
    }, [updateSearchParams]);

    const setResultsSlug = useCallback((slug?: string, options?: UpdateOptions) => {
        updateSearchParams({ results: slug ?? null }, options);
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
        const [pluginId, modifierSlug] = pluginParam.split(':');
        return pluginId && modifierSlug ? { pluginId, modifierSlug } : null;
    }, [pluginParam]);

    return {
        searchParams,
        updateSearchParams,
        setParam,
        removeParam,
        analysisId,
        resultsSlug,
        pluginParam,
        pluginSelection,
        settingsKey,
        showWidgets,
        showGrid,
        renderConfigOpen,
        activeModifiers,
        toggleModifier,
        isModifierSelected,
        setAnalysisId,
        setResultsSlug,
        setPluginParam,
        setSettingsKey,
        setRenderConfigOpen,
        setModifiers
    };
};

export default useCanvasUrlState;

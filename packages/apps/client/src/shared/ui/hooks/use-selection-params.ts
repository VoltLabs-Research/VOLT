import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applySearchParamUpdates } from './use-search-params';

interface UseSelectionParamsOptions {
    paramName?: string;
    multi?: boolean;
};

interface UseSelectionParamsReturn {
    selectedIds: string[];
    isSelected: (id: string) => boolean;
    toggleSelection: (id: string) => void;
    selectMultiple: (ids: string[]) => void;
    clearSelection: () => void;
    selectAll: (ids: string[]) => void;
};

const useSelectionParams = ({
    paramName = 'selected',
    multi = true
}: UseSelectionParamsOptions = {}): UseSelectionParamsReturn => {
    const [searchParams, setSearchParams] = useSearchParams();

    const getSelectedIds = useCallback(() => {
        const param = searchParams.get(paramName);
        if(!param) return [];
        return multi ? param.split(',').filter(Boolean) : [param];
    }, [searchParams, paramName, multi]);

    const selectedIds = useMemo(() => getSelectedIds(), [getSelectedIds]);

    const updateSelection = useCallback((ids: string[]) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, {
            [paramName]: ids.length === 0 ? null : (multi ? ids.join(',') : ids[0])
        }));
    }, [setSearchParams, paramName, multi]);

    const updateSelectionRef = useRef(updateSelection);

    useEffect(() => {
        updateSelectionRef.current = updateSelection;
    }, [updateSelection]);

    const isSelected = useCallback((id: string) => {
        return selectedIds.includes(id);
    }, [selectedIds]);

    const toggleSelection = useCallback((id: string) => {
        const currentIds = getSelectedIds();
        updateSelectionRef.current(
            currentIds.includes(id)
                ? currentIds.filter((sid) => sid !== id)
                : multi ? [...currentIds, id] : [id]
        );
    }, [getSelectedIds, multi]);

    const clearSelection = useCallback(() => {
        updateSelectionRef.current([]);
    }, []);

    const selectAll = useCallback((ids: string[]) => {
        updateSelectionRef.current(ids);
    }, []);

    const selectMultiple = useCallback((ids: string[]) => {
        if(!multi) throw new Error('Multi-selection not enabled');
        const currentIds = getSelectedIds();
        updateSelectionRef.current([...new Set([...currentIds, ...ids])]);
    }, [multi, getSelectedIds]);

    return {
        selectedIds,
        isSelected,
        toggleSelection,
        selectMultiple,
        clearSelection,
        selectAll
    };
};

export default useSelectionParams;

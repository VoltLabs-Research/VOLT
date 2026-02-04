import { useCallback, useMemo } from 'react';
import useSearchParamsState from './use-search-params';

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
    const { searchParams, updateSearchParams } = useSearchParamsState();

    const selectedIds = useMemo(() => {
        const param = searchParams.get(paramName);
        if(!param) return [];
        return multi ? param.split(',').filter(Boolean) : [param];
    }, [searchParams, paramName, multi]);

    const updateSelection = useCallback((ids: string[]) => {
        updateSearchParams({
            [paramName]: ids.length === 0 ? null : (multi ? ids.join(',') : ids[0])
        });
    }, [updateSearchParams, paramName, multi]);

    const isSelected = useCallback((id: string) => {
        return selectedIds.includes(id);
    }, [selectedIds]);

    const toggleSelection = useCallback((id: string) => {
        updateSelection(
            selectedIds.includes(id)
                ? selectedIds.filter((sid) => sid !== id)
                : multi ? [...selectedIds, id] : [id]
        );
    }, [selectedIds, multi, updateSelection]);

    const clearSelection = useCallback(() => {
        updateSelection([]);
    }, [updateSelection]);

    const selectAll = useCallback((ids: string[]) => {
        updateSelection(ids);
    }, [updateSelection]);

    const selectMultiple = useCallback((ids: string[]) => {
        if(!multi) throw new Error('Multi-selection not enabled');
        updateSelection([...new Set([...selectedIds, ...ids])]);
    }, [multi, selectedIds, updateSelection]);

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

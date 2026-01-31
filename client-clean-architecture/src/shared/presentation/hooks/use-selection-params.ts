import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

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

    const selectedIds = useMemo(() => {
        const param = searchParams.get(paramName);
        if(!param) return [];
        return multi ? param.split(',').filter(Boolean) : [param];
    }, [searchParams, paramName, multi]);

    const updateSelection = useCallback((ids: string[]) => {
        setSearchParams((prev) => {
            if(ids.length === 0){
                prev.delete(paramName);
            }else{
                prev.set(paramName, multi ? ids.join(',') : ids[0]);
            }
            return prev;
        });
    }, [setSearchParams, paramName, multi]);

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

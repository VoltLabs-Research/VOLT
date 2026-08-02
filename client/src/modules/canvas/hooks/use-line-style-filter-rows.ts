import { useCallback, useState } from 'react';

import type { LineStyleFilterRow } from '../utils/line-style-spec';

let filterRowCounter = 0;

/**
 * Owns the editable list of numeric threshold filters in the line style editor.
 */
const useLineStyleFilterRows = (defaultProperty: string) => {
    const [filterRows, setFilterRows] = useState<LineStyleFilterRow[]>([]);

    const addFilterRow = useCallback(() => {
        filterRowCounter += 1;
        setFilterRows((current) => [...current, {
            id: `line-style-filter-${filterRowCounter}`,
            property: defaultProperty,
            operator: 'gte',
            valueInput: ''
        }]);
    }, [defaultProperty]);

    const removeFilterRow = useCallback((rowId: string) => {
        setFilterRows((current) => current.filter((row) => row.id !== rowId));
    }, []);

    const updateFilterRow = useCallback((rowId: string, patch: Partial<Omit<LineStyleFilterRow, 'id'>>) => {
        setFilterRows((current) => current.map((row) => row.id === rowId ? {
            ...row,
            ...patch
        } : row));
    }, []);

    return {
        filterRows,
        addFilterRow,
        removeFilterRow,
        updateFilterRow
    };
};

export default useLineStyleFilterRows;

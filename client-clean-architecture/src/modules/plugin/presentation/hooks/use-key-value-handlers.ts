import { useCallback } from 'react';

/**
 * Hook to manage key-value operations for nested objects in node data.
 * Used by KeyValueEditor in ExportEditor, VisualizersEditor, etc.
 */
export function useKeyValueHandlers(
    updateParent: (newEntries: Record<string, string>) => void,
    entries: Record<string, string>,
    defaultKeyPrefix: string = 'item',
    defaultValue: string = ''
) {
    const handleKeyChange = useCallback((oldKey: string, newKey: string) => {
        if (oldKey === newKey || !newKey.trim()) return;

        const newEntries: Record<string, string> = {};
        for (const [k, v] of Object.entries(entries)) {
            newEntries[k === oldKey ? newKey : k] = v;
        }
        updateParent(newEntries);
    }, [entries, updateParent]);

    const handleValueChange = useCallback((key: string, value: string) => {
        updateParent({ ...entries, [key]: value });
    }, [entries, updateParent]);

    const handleAdd = useCallback(() => {
        let counter = 1;
        let newKey = `${defaultKeyPrefix}_${counter}`;

        while (entries[newKey] !== undefined) {
            counter++;
            newKey = `${defaultKeyPrefix}_${counter}`;
        }

        updateParent({ ...entries, [newKey]: defaultValue });
    }, [entries, updateParent, defaultKeyPrefix, defaultValue]);

    const handleRemove = useCallback((key: string) => {
        const newEntries = { ...entries };
        delete newEntries[key];
        updateParent(newEntries);
    }, [entries, updateParent]);

    return {
        handleKeyChange,
        handleValueChange,
        handleAdd,
        handleRemove,
        entries: Object.entries(entries) as [string, string][]
    };
}

export default useKeyValueHandlers;

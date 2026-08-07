import { applySearchParamUpdates } from '@/shared/ui/hooks/use-search-params';
import { getColumnKey } from '@/shared/ui/components/DocumentListingTable';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { SortConfig } from '@/shared/utils/sort';
import type { QueryKey } from '@tanstack/react-query';

/**
 * Marks "the user explicitly hid nothing", which cannot be expressed by an absent
 * param because absence means "fall back to the flex-col defaults".
 */
const NONE_HIDDEN = '-';

const hashString = (value: string): string => {
    let hash = 0;
    for(let i = 0; i < value.length; i++){
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
};

export const resolvePersistenceKey = (queryKey: QueryKey): string => {
    return `list-${hashString(JSON.stringify(queryKey))}`;
};

const resolveActiveTabId = (tabIds: string[], preferredTabId: string | null | undefined): string => {
    if(preferredTabId && tabIds.includes(preferredTabId)){
        return preferredTabId;
    }

    return tabIds[0] || 'list';
};

const resolveSortConfig = (key: string | null, direction: string | null): SortConfig | null => {
    if(!key || (direction !== 'asc' && direction !== 'desc')) return null;

    return {
        key,
        direction
    };
};

const decodeHiddenColumns = (raw: string | null, defaultHiddenKeys: Set<string>): Set<string> => {
    if(raw === null) return defaultHiddenKeys;
    if(raw === NONE_HIDDEN) return new Set();

    return new Set(raw.split(',').filter(Boolean));
};

const encodeHiddenColumns = (hiddenKeys: Set<string>, defaultHiddenKeys: Set<string>): string | null => {
    const sortedKeys = [...hiddenKeys].sort();
    const sortedDefaults = [...defaultHiddenKeys].sort();
    const matchesDefaults = sortedKeys.length === sortedDefaults.length
        && sortedKeys.every((key, index) => key === sortedDefaults[index]);

    if(matchesDefaults) return null;

    return sortedKeys.join(',') || NONE_HIDDEN;
};

interface UseListingViewPreferencesParams<TRow> {
    queryKey: QueryKey;
    columns: ColumnConfig<TRow>[];
    tabIds: string[];
    defaultTabId?: string;
    onTabChange?: (tabId: string) => void;
};

export interface ListingViewPreferences<TRow> {
    persistenceKey: string;
    activeTabId: string;
    selectTab: (tabId: string) => void;
    sortConfig: SortConfig | null;
    toggleSort: (columnKey: string) => void;
    hiddenColumnKeys: Set<string>;
    toggleColumnVisibility: (columnKey: string) => void;
    visibleColumns: ColumnConfig<TRow>[];
};

/**
 * Keeps the active tab, sort and hidden columns of a listing in the URL, which is
 * the single source of truth so the view survives reloads and shared links.
 */
const useListingViewPreferences = <TRow,>({
    queryKey,
    columns,
    tabIds,
    defaultTabId,
    onTabChange
}: UseListingViewPreferencesParams<TRow>): ListingViewPreferences<TRow> => {
    const [searchParams, setSearchParams] = useSearchParams();
    const persistenceKey = resolvePersistenceKey(queryKey);
    const tabParamKey = `${persistenceKey}-tab`;
    const sortKeyParamKey = `${persistenceKey}-sort`;
    const sortDirectionParamKey = `${persistenceKey}-dir`;
    const hiddenColumnsParamKey = `${persistenceKey}-hide`;
    const sortKeyParam = searchParams.get(sortKeyParamKey);
    const sortDirectionParam = searchParams.get(sortDirectionParamKey);
    const hiddenColumnsParam = searchParams.get(hiddenColumnsParamKey);

    const sortConfig = useMemo(
        () => resolveSortConfig(sortKeyParam, sortDirectionParam),
        [sortKeyParam, sortDirectionParam]
    );

    const defaultHiddenColumnKeys = useMemo(() => {
        return new Set(columns.filter((col) => col.defaultHidden).map(getColumnKey));
    }, [columns]);

    const hiddenColumnKeys = useMemo(
        () => decodeHiddenColumns(hiddenColumnsParam, defaultHiddenColumnKeys),
        [hiddenColumnsParam, defaultHiddenColumnKeys]
    );

    const visibleColumns = useMemo(() => {
        return columns.filter((col) => !hiddenColumnKeys.has(getColumnKey(col)));
    }, [columns, hiddenColumnKeys]);

    const updateParams = (updates: Record<string, string | null>) => {
        setSearchParams((previous) => applySearchParamUpdates(previous, updates), { replace: true });
    };

    const toggleSort = (columnKey: string) => {
        const isDescending = sortConfig?.key === columnKey && sortConfig.direction === 'asc';

        updateParams({
            [sortKeyParamKey]: columnKey,
            [sortDirectionParamKey]: isDescending ? 'desc' : 'asc'
        });
    };

    const toggleColumnVisibility = (columnKey: string) => {
        const nextHiddenKeys = new Set(hiddenColumnKeys);

        if(nextHiddenKeys.has(columnKey)){
            nextHiddenKeys.delete(columnKey);
        }else{
            nextHiddenKeys.add(columnKey);
        }

        updateParams({ [hiddenColumnsParamKey]: encodeHiddenColumns(nextHiddenKeys, defaultHiddenColumnKeys) });
    };

    return {
        persistenceKey,
        activeTabId: resolveActiveTabId(tabIds, searchParams.get(tabParamKey) ?? defaultTabId),
        selectTab: (tabId: string) => {
            updateParams({ [tabParamKey]: tabId });
            onTabChange?.(tabId);
        },
        sortConfig,
        toggleSort,
        hiddenColumnKeys,
        toggleColumnVisibility,
        visibleColumns
    };
};

export default useListingViewPreferences;

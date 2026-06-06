import { isAccessDeniedCode } from '@/shared/errors/core';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { getValueByPath } from '@/shared/utils/format';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { sortData, type SortConfig } from '@/shared/utils/sort';
import useSocketQueryInvalidation from '@/modules/socket/hooks/use-socket-query-invalidation';
import type { SocketInvalidationRule } from '@/modules/socket/hooks/use-socket-query-invalidation';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Popover from '@/shared/presentation/primitives/Popover';
import Row from '@/shared/presentation/primitives/Row';
import SegmentedTabs from '@/shared/presentation/primitives/SegmentedTabs';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import AsyncMenuItemWrapper from '@/shared/presentation/primitives/AsyncMenuItemWrapper';
import DocumentListingGrid from '@/shared/presentation/components/DocumentListingGrid';
import DocumentListingTable from '@/shared/presentation/components/DocumentListingTable';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import PopoverMenu from '@/shared/presentation/primitives/PopoverMenu';
import useDocumentListingPagination from '@/shared/presentation/hooks/use-document-listing-pagination';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';

import './DocumentListing.css';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Columns3, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RiFileCopyLine } from 'react-icons/ri';
import { RxDotsHorizontal } from 'react-icons/rx';
import React from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { QueryKey } from '@tanstack/react-query';

export interface SocketInvalidationConfig {
    event: string;
    queryKeys: QueryKey[];
};

export interface DocumentListingTab {
    id: string;
    label: string;
};

type ViewMode = 'table' | 'grid';

interface DocumentListingProps<T extends { _id: string }, TContext = Record<string, never>> {
    title: string | React.ReactNode;
    description?: React.ReactNode;
    queryKey: QueryKey;
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<T>>;
    transformData?: (data: T[]) => T[];
    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
    emptyMessage?: string;
    createNew?: { buttonTitle: string; onCreate: () => void };
    headerActions?: React.ReactNode;
    headerMenuOptions?: MenuOption[];
    columns?: ColumnConfig<T>[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    onItemClick?: (item: T, event: React.MouseEvent) => boolean;
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
    view?: ViewMode;
    renderGridItem?: (item: T, index: number) => React.ReactNode;
    renderGridSkeleton?: () => React.ReactNode;
    gridBeforeContent?: React.ReactNode;
    gridClassName?: string;
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyButtonText?: string;
    emptyButtonIsLoading?: boolean;
    onEmptyButtonClick?: () => void;
    hideHeader?: boolean;
    hideTabs?: boolean;
    includeCopyDocumentId?: boolean;
    tabs?: DocumentListingTab[];
    defaultTabId?: string;
    onTabChange?: (tabId: string) => void;
    socketInvalidation?: SocketInvalidationConfig[];
};

const DEFAULT_TABS: DocumentListingTab[] = [
    {
        id: 'list',
        label: 'List'
    }
];

const VISUALLY_HIDDEN_STYLES: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
};

const resolveInitialTabId = (tabs: DocumentListingTab[], preferredTabId?: string): string => {
    if (preferredTabId && tabs.some((tab) => tab.id === preferredTabId)) {
        return preferredTabId;
    }

    return tabs[0]?.id || 'list';
};

const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
};

const resolvePersistenceKey = (queryKey: QueryKey): string => {
    return `list-${hashString(JSON.stringify(queryKey))}`;
};

const DocumentListing = <T extends { _id: string }, TContext = Record<string, never>>({
    title,
    description,
    queryKey,
    fetchData,
    transformData,
    context,
    defaultLimit = 20,
    enabled = true,
    columns = [],
    getMenuOptions,
    onItemClick,
    dragAndDrop,
    emptyMessage = 'No data available',
    createNew,
    headerActions,
    headerMenuOptions = [],
    view = 'table',
    renderGridItem,
    renderGridSkeleton,
    gridBeforeContent,
    gridClassName = '',
    emptyIcon,
    emptyTitle,
    emptyButtonText,
    emptyButtonIsLoading = false,
    onEmptyButtonClick,
    hideHeader = false,
    hideTabs = false,
    includeCopyDocumentId = true,
    tabs,
    defaultTabId,
    onTabChange,
    socketInvalidation
}: DocumentListingProps<T, TContext>) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [searchParams, setSearchParams] = useSearchParams();
    const resolvedTabs = useMemo(() => tabs?.length ? tabs : DEFAULT_TABS, [tabs]);
    const persistenceKey = useMemo(() => resolvePersistenceKey(queryKey), [queryKey]);
    const tabParamKey = `${persistenceKey}-tab`;
    const sortKeyParamKey = `${persistenceKey}-sort`;
    const sortDirectionParamKey = `${persistenceKey}-dir`;
    const hiddenColumnsParamKey = `${persistenceKey}-hide`;
    const persistedTabId = searchParams.get(tabParamKey) || undefined;
    const persistedSortKey = searchParams.get(sortKeyParamKey) || undefined;
    const persistedSortDirection = searchParams.get(sortDirectionParamKey);
    const persistedHiddenColumns = searchParams.get(hiddenColumnsParamKey);
    const initialTabId = useMemo(() => {
        return resolveInitialTabId(resolvedTabs, persistedTabId ?? defaultTabId);
    }, [defaultTabId, persistedTabId, resolvedTabs]);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(() => {
        if (!persistedSortKey || (persistedSortDirection !== 'asc' && persistedSortDirection !== 'desc')) {
            return null;
        }

        return {
            key: persistedSortKey,
            direction: persistedSortDirection
        };
    });
    const [activeTabId, setActiveTabId] = useState(initialTabId);
    const getColumnKey = useCallback((col: ColumnConfig<T>): string => {
        return String(col.key ?? col.path ?? '');
    }, []);
    const defaultHiddenColumnKeys = useMemo(() => {
        return new Set(columns.filter((col) => col.defaultHidden).map(getColumnKey));
    }, [columns, getColumnKey]);
    const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(() => {
        if (persistedHiddenColumns !== null) {
            return new Set(persistedHiddenColumns.split(',').filter(Boolean));
        }
        return defaultHiddenColumnKeys;
    });
    const visibleColumns = useMemo(() => {
        return columns.filter((col) => !hiddenColumnKeys.has(getColumnKey(col)));
    }, [columns, hiddenColumnKeys, getColumnKey]);
    const toggleColumnVisibility = useCallback((columnKey: string) => {
        setHiddenColumnKeys((previous) => {
            const next = new Set(previous);
            if (next.has(columnKey)) {
                next.delete(columnKey);
            } else {
                next.add(columnKey);
            }
            return next;
        });
    }, []);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setActiveTabId(initialTabId);
    }, [initialTabId]);

    useEffect(() => {
        const currentTab = searchParams.get(tabParamKey);
        const currentSortKey = searchParams.get(sortKeyParamKey);
        const currentSortDirection = searchParams.get(sortDirectionParamKey);
        const currentHiddenColumns = searchParams.get(hiddenColumnsParamKey);
        const shouldPersistTab = !hideTabs && resolvedTabs.length > 1;
        const nextTab = shouldPersistTab ? activeTabId : null;

        const hiddenKeysSorted = [...hiddenColumnKeys].sort();
        const defaultHiddenSorted = [...defaultHiddenColumnKeys].sort();
        const matchesDefault = hiddenKeysSorted.length === defaultHiddenSorted.length
            && hiddenKeysSorted.every((key, index) => key === defaultHiddenSorted[index]);
        const nextHiddenColumns = matchesDefault ? null : (hiddenKeysSorted.join(',') || '');

        if (
            currentTab === nextTab
            && currentSortKey === (sortConfig?.key ?? null)
            && currentSortDirection === (sortConfig?.direction ?? null)
            && currentHiddenColumns === nextHiddenColumns
        ) {
            return;
        }

        setSearchParams((prev) => applySearchParamUpdates(prev, {
            [tabParamKey]: nextTab,
            [sortKeyParamKey]: sortConfig?.key ?? null,
            [sortDirectionParamKey]: sortConfig?.direction ?? null,
            [hiddenColumnsParamKey]: nextHiddenColumns
        }), { replace: true });
    }, [activeTabId, defaultHiddenColumnKeys, hiddenColumnKeys, hiddenColumnsParamKey, hideTabs, resolvedTabs.length, searchParams, setSearchParams, sortConfig, sortDirectionParamKey, sortKeyParamKey, tabParamKey]);

    const getColumnSortKey = useCallback((col: ColumnConfig<T>): string => {
        return String(col.key ?? col.path ?? '');
    }, []);

    const {
        data,
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        errorCode,
        handleLoadMore,
        refresh
    } = useDocumentListingPagination<T, TContext>({
        queryKey,
        fetchData,
        transformData,
        context,
        defaultLimit,
        enabled
    });
    const invalidationRules = useMemo<SocketInvalidationRule[]>(
        () => (socketInvalidation ?? []).map(({ event, queryKeys }) => ({ event, queryKeys })),
        [socketInvalidation]
    );

    useSocketQueryInvalidation(invalidationRules, { enabled: invalidationRules.length > 0 });

    const wrappedGetMenuOptions = useCallback((item: T, selectedItems: T[]) => {
        const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];
        const itemId = typeof item._id === 'string' ? item._id.trim() : '';

        if (!itemId || menuOptions.some((option) => option.label === 'Copy Document ID')) {
            return menuOptions;
        }

        if (!includeCopyDocumentId) {
            return menuOptions;
        }

        return [
            ...menuOptions,
            {
                label: 'Copy Document ID',
                icon: RiFileCopyLine,
                onClick: async () => {
                    await copyTextToClipboard(itemId, {
                        successMessage: 'Document ID copied to clipboard',
                        errorMessage: 'Failed to copy document ID'
                    });
                }
            }
        ];
    }, [getMenuOptions, includeCopyDocumentId]);

    const sortedData = useMemo(() => {
        if (!sortConfig || data.length < 2) {
            return data;
        }

        return sortData(data, sortConfig, getValueByPath);
    }, [data, sortConfig]);

    const handleSort = useCallback((col: ColumnConfig<T>) => {
        if (!col.sortable) {
            return;
        }

        const columnKey = getColumnSortKey(col);
        if (!columnKey) {
            return;
        }

        setSortConfig((previousSortConfig) => {
            if (previousSortConfig && previousSortConfig.key === columnKey) {
                return {
                    key: columnKey,
                    direction: previousSortConfig.direction === 'asc' ? 'desc' : 'asc'
                };
            }

            return {
                key: columnKey,
                direction: 'asc'
            };
        });
    }, [getColumnSortKey]);

    const getSortIndicator = useCallback((col: ColumnConfig<T>) => {
        if (!col.sortable) {
            return null;
        }

        const columnKey = getColumnSortKey(col);
        const isActive = sortConfig?.key === columnKey;
        const Icon = !isActive
            ? ArrowUpDown
            : sortConfig.direction === 'asc' ? ArrowUp : ArrowDown;

        return (
            <span
                className={`sort-indicator d-flex flex-center ${isActive ? 'is-active' : ''}`}
                aria-hidden='true'
            >
                <Icon size={12} strokeWidth={2} />
            </span>
        );
    }, [getColumnSortKey, sortConfig]);

    const getAriaSort = useCallback((col: ColumnConfig<T>): 'ascending' | 'descending' | 'none' => {
        if (!col.sortable) {
            return 'none';
        }

        const columnKey = getColumnSortKey(col);
        if (!sortConfig || sortConfig.key !== columnKey) {
            return 'none';
        }

        return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
    }, [getColumnSortKey, sortConfig]);

    const sortAnnouncement = useMemo(() => {
        if (!sortConfig) {
            return 'List sorted by default order.';
        }

        const activeColumn = columns.find((column) => getColumnSortKey(column) === sortConfig.key);
        const columnTitle = activeColumn ? String(activeColumn.title ?? activeColumn.label ?? activeColumn.key ?? activeColumn.path ?? 'selected column') : 'selected column';
        const directionLabel = sortConfig.direction === 'asc' ? 'ascending' : 'descending';

        return `Sorted by ${columnTitle} in ${directionLabel} order.`;
    }, [columns, getColumnSortKey, sortConfig]);

    const headerMenuTrigger = useMemo(() => {
        if (!headerMenuOptions.length) {
            return null;
        }

        return (
            <Button
                variant='ghost'
                intent='neutral'
                size='sm'
                shape='circle'
                iconOnly
                title='Open listing actions'
                aria-label='Open listing actions'
            >
                <RxDotsHorizontal />
            </Button>
        );
    }, [headerMenuOptions.length]);

    const shouldShowColumnPicker = view === 'table' && columns.length > 1;
    const columnPickerTrigger = useMemo(() => {
        if (!shouldShowColumnPicker) return null;
        return (
            <Button
                variant='ghost'
                intent='neutral'
                size='sm'
                shape='circle'
                iconOnly
                title='Toggle columns'
                aria-label='Toggle columns'
            >
                <Columns3 size={16} />
            </Button>
        );
    }, [shouldShowColumnPicker]);

    const handleTabChange = useCallback((tabId: string) => {
        const targetTab = resolvedTabs.find((tab) => tab.id === tabId);
        if (!targetTab) {
            return;
        }

        setActiveTabId(targetTab.id);
        onTabChange?.(targetTab.id);
    }, [onTabChange, resolvedTabs]);

    const isAccessDenied = !!errorCode && isAccessDeniedCode(errorCode);

    const renderContent = () => {
        if (view === 'grid') {
            if (!renderGridItem) {
                return null;
            }

            return (
                <DocumentListingGrid
                    data={sortedData}
                    isLoading={isLoading}
                    isFetchingMore={isFetchingMore}
                    hasMore={hasMore}
                    onLoadMore={handleLoadMore}
                    renderItem={renderGridItem}
                    renderSkeleton={renderGridSkeleton}
                    emptyIcon={emptyIcon}
                    emptyTitle={emptyTitle}
                    emptyMessage={emptyMessage}
                    emptyButtonText={emptyButtonText}
                    emptyButtonIsLoading={emptyButtonIsLoading}
                    onEmptyButtonClick={onEmptyButtonClick}
                    beforeContent={gridBeforeContent}
                    getMenuOptions={wrappedGetMenuOptions}
                    dragAndDrop={dragAndDrop}
                    className={gridClassName}
                    errorMessage={error}
                    isAccessDenied={isAccessDenied}
                    onRetry={refresh}
                    retryButtonText='Try again'
                />
            );
        }

        return (
            <div ref={scrollContainerRef} className='document-listing-body-container overflow-auto flex-1'>
                <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    style={{ height: '100%' }}
                >
                    <DocumentListingTable
                        listingLabel={typeof title === 'string' ? title : undefined}
                        columns={visibleColumns}
                        data={sortedData}
                        onCellClick={handleSort}
                        getCellTitle={(col) => <>{col.title} {getSortIndicator(col)}</>}
                        getAriaSort={getAriaSort}
                        isLoading={isLoading}
                        getMenuOptions={wrappedGetMenuOptions}
                        onItemClick={onItemClick}
                        dragAndDrop={dragAndDrop}
                        emptyMessage={emptyMessage}
                        hasMore={hasMore}
                        isFetchingMore={isFetchingMore}
                        onLoadMore={handleLoadMore}
                        emptyButtonText={emptyButtonText}
                        onEmptyButtonClick={onEmptyButtonClick}
                        errorMessage={error}
                        isAccessDenied={isAccessDenied}
                        onRetry={refresh}
                        retryButtonText='Try again'
                        scrollContainerRef={scrollContainerRef}
                    />
                </motion.div>
            </div>
        );
    };

    return (
        <Stack height='max' gap='1' className='document-listing-container color-secondary'>
            <span style={VISUALLY_HIDDEN_STYLES} aria-live='polite' aria-atomic='true'>
                {sortAnnouncement}
            </span>
            {!hideHeader && (
                <div className='d-flex column gap-3'>
                    <Stack gap='1-5' p='2' className='document-listing-header-top-container'>
                        <Row justify='between' align='start' gap='1-5' className='document-listing-header-row'>
                            <Row gap='1' align='start' className='document-listing-header-main'>
                                {isLoading && !data.length ? (
                                    <Stack gap='025'>
                                        <Skeleton variant='text' width={220} height={32} />
                                        {description ? <Skeleton variant='text' width={224} height={18} /> : null}
                                    </Stack>
                                ) : (
                                    <Stack gap='025' className='document-listing-header-title-block'>
                                        {typeof title === 'string' ? (
                                            <Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>{title}</Heading>
                                        ) : (
                                            title
                                        )}
                                        {description ? (
                                            <Text as='p' size='sm' tone='muted' className='document-listing-header-description'>
                                                {description}
                                            </Text>
                                        ) : null}
                                    </Stack>
                                )}
                                {(headerMenuTrigger || columnPickerTrigger) && (
                                    <Row gap='05'>
                                        {columnPickerTrigger && (
                                            <Popover
                                                id='document-listing-column-picker'
                                                trigger={columnPickerTrigger}
                                                noPadding
                                                className='context-menu-popover context-menu-popover--md'
                                            >
                                                {() => (
                                                    <PopoverMenu label='Toggle columns'>
                                                        {columns.map((col) => {
                                                            const columnKey = getColumnKey(col);
                                                            const optionLabel = String(col.title ?? col.label ?? col.key ?? col.path ?? columnKey);
                                                            const isVisible = !hiddenColumnKeys.has(columnKey);
                                                            return (
                                                                <button
                                                                    type='button'
                                                                    role='menuitemcheckbox'
                                                                    aria-checked={isVisible}
                                                                    key={`document-listing-column-option-${columnKey}`}
                                                                    className='document-listing-column-picker-item d-flex items-center gap-075'
                                                                    onClick={() => toggleColumnVisibility(columnKey)}
                                                                >
                                                                    <span className='document-listing-column-picker-check d-flex flex-center' aria-hidden='true'>
                                                                        {isVisible ? <Check size={14} /> : null}
                                                                    </span>
                                                                    <span className='flex-1 text-left'>{optionLabel}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </PopoverMenu>
                                                )}
                                            </Popover>
                                        )}
                                        {headerMenuTrigger && (
                                            <Popover
                                                id='document-listing-header-menu'
                                                trigger={headerMenuTrigger}
                                                noPadding
                                                className='context-menu-popover context-menu-popover--md'
                                            >
                                                {(close) => (
                                                    <PopoverMenu>
                                                        {headerMenuOptions.map((option, index) => (
                                                            <AsyncMenuItemWrapper
                                                                key={`document-listing-header-option-${option.label}-${index}`}
                                                                option={option}
                                                                size='md'
                                                                onSuccess={close}
                                                            />
                                                        ))}
                                                    </PopoverMenu>
                                                )}
                                            </Popover>
                                        )}
                                    </Row>
                                )}
                            </Row>
                            <Row gap='2' className='document-listing-header-actions'>
                                {headerActions}
                                {createNew && (
                                    <Button variant='solid' intent='brand' onClick={createNew.onCreate} leftIcon={<Plus size={18} />}>
                                        {createNew.buttonTitle}
                                    </Button>
                                )}
                            </Row>
                        </Row>
                    </Stack>

                    {!hideTabs && resolvedTabs.length >= 2 && (
                        <div>
                            <div className='document-listing-header-tabs-container'>
                                <SegmentedTabs
                                    tabs={resolvedTabs}
                                    activeTab={activeTabId}
                                    onChange={handleTabChange}
                                    ariaLabel='Listing views'
                                    layoutId={`${persistenceKey}-tabs`}
                                />
                            </div>
                            <div className='document-listing-header-filters-container' />
                        </div>
                    )}
                </div>
            )}

            {renderContent()}
        </Stack>
    );
};

export default DocumentListing;

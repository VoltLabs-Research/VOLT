import { isAccessDeniedCode } from '@/shared/errors/core';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { getValueByPath } from '@/shared/utils/format';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SortConfig } from '@/shared/domain/sorting/types';
import { sortData } from '@/shared/utils/sort';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import queryClient from '@/shared/infrastructure/query/query-client';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import AsyncMenuItemWrapper from '@/shared/presentation/components/AsyncMenuItemWrapper';
import DocumentListingGrid from '@/shared/presentation/components/DocumentListingGrid';
import DocumentListingTable from '@/shared/presentation/components/DocumentListingTable';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import SegmentedTabs from '@/shared/presentation/components/SegmentedTabs';
import Title from '@/shared/presentation/components/Title';
import useDocumentListingPagination from '@/shared/presentation/hooks/use-document-listing-pagination';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';

import './DocumentListing.css';
import { Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Plus } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { RiFileCopyLine } from 'react-icons/ri';
import { RxDotsHorizontal } from 'react-icons/rx';
import React from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { QueryKey } from '@tanstack/react-query';

export type { ColumnConfig, MenuOption };
export { getValueByPath };

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
    docLink?: string;
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
    gap?: string;
    columns?: ColumnConfig<T>[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    onItemClick?: (item: T, event: React.MouseEvent) => boolean;
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
    view?: ViewMode;
    renderGridItem?: (item: T, index: number) => React.ReactNode;
    renderGridSkeleton?: () => React.ReactNode;
    gridClassName?: string;
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyButtonText?: string;
    emptyButtonIsLoading?: boolean;
    onEmptyButtonClick?: () => void;
    hideHeader?: boolean;
    hideTabs?: boolean;
    tabs?: DocumentListingTab[];
    defaultTabId?: string;
    onTabChange?: (tabId: string) => void;
    socketInvalidation?: SocketInvalidationConfig[];
    compact?: boolean;
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

const sanitizePersistenceKey = (value: string): string => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'listing';
};

const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
};

const resolvePersistenceKey = (queryKey: QueryKey): string => {
    return sanitizePersistenceKey(`list-${hashString(JSON.stringify(queryKey))}`);
};

const DocumentListing = <T extends { _id: string }, TContext = Record<string, never>>({
    title,
    description,
    docLink,
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
    gap = 'gap-3',
    view = 'table',
    renderGridItem,
    renderGridSkeleton,
    gridClassName = '',
    emptyIcon,
    emptyTitle,
    emptyButtonText,
    emptyButtonIsLoading = false,
    onEmptyButtonClick,
    hideHeader = false,
    hideTabs = false,
    tabs,
    defaultTabId,
    onTabChange,
    socketInvalidation,
    compact = false
}: DocumentListingProps<T, TContext>) => {
    const socketService = useSocket();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [searchParams, setSearchParams] = useSearchParams();
    const resolvedTabs = useMemo(() => tabs?.length ? tabs : DEFAULT_TABS, [tabs]);
    const persistenceKey = useMemo(() => resolvePersistenceKey(queryKey), [queryKey]);
    const tabParamKey = `${persistenceKey}-tab`;
    const sortKeyParamKey = `${persistenceKey}-sort`;
    const sortDirectionParamKey = `${persistenceKey}-dir`;
    const persistedTabId = searchParams.get(tabParamKey) || undefined;
    const persistedSortKey = searchParams.get(sortKeyParamKey) || undefined;
    const persistedSortDirection = searchParams.get(sortDirectionParamKey);
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setActiveTabId(initialTabId);
    }, [initialTabId]);

    useEffect(() => {
        const currentTab = searchParams.get(tabParamKey);
        const currentSortKey = searchParams.get(sortKeyParamKey);
        const currentSortDirection = searchParams.get(sortDirectionParamKey);
        const shouldPersistTab = !hideTabs && resolvedTabs.length > 1;
        const nextTab = shouldPersistTab ? activeTabId : null;

        if (
            currentTab === nextTab
            && currentSortKey === (sortConfig?.key ?? null)
            && currentSortDirection === (sortConfig?.direction ?? null)
        ) {
            return;
        }

        setSearchParams((prev) => applySearchParamUpdates(prev, {
            [tabParamKey]: nextTab,
            [sortKeyParamKey]: sortConfig?.key ?? null,
            [sortDirectionParamKey]: sortConfig?.direction ?? null
        }), { replace: true });
    }, [activeTabId, hideTabs, resolvedTabs.length, searchParams, setSearchParams, sortConfig, sortDirectionParamKey, sortKeyParamKey, tabParamKey]);

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
    const deferredData = useDeferredValue(data);
    const socketInvalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingQueryKeysRef = useRef<Map<string, QueryKey>>(new Map());
    const socketInvalidationRef = useRef<SocketInvalidationConfig[] | undefined>(socketInvalidation);

    useEffect(() => {
        socketInvalidationRef.current = socketInvalidation;
    }, [socketInvalidation]);

    useEffect(() => {
        if (!socketInvalidation?.length) {
            return;
        }

        const flushInvalidations = () => {
            const queryKeys = Array.from(pendingQueryKeysRef.current.values());
            pendingQueryKeysRef.current.clear();
            socketInvalidationTimerRef.current = null;
            Promise.allSettled(
                queryKeys.map((currentQueryKey) => queryClient.invalidateQueries({ queryKey: currentQueryKey }))
            );
        };

        const events = new Set<string>();
        for (const { event } of socketInvalidation) events.add(event);

        const unsubscribers = Array.from(events).map((event) => {
            return socketService.on(event, () => {
                const current = socketInvalidationRef.current ?? [];
                for (const entry of current) {
                    if (entry.event !== event) continue;
                    for (const key of entry.queryKeys) {
                        pendingQueryKeysRef.current.set(JSON.stringify(key), key);
                    }
                }

                if (socketInvalidationTimerRef.current) return;
                socketInvalidationTimerRef.current = setTimeout(flushInvalidations, 150);
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read latest via ref to avoid tearing down listeners
    }, [socketService, socketInvalidation?.map((entry) => entry.event).sort().join(',')]);

    const wrappedGetMenuOptions = useCallback((item: T, selectedItems: T[]) => {
        const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];
        const itemId = typeof item._id === 'string' ? item._id.trim() : '';

        if (!itemId || menuOptions.some((option) => option.label === 'Copy Document ID')) {
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
    }, [getMenuOptions]);

    const sortedData = useMemo(() => {
        if (!sortConfig || deferredData.length < 2) {
            return deferredData;
        }

        return sortData(deferredData, sortConfig, getValueByPath);
    }, [deferredData, sortConfig]);

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

    const headerDocLink = useMemo(() => {
        if (!docLink) {
            return null;
        }

        return (
            <a
                href={docLink}
                target='_blank'
                rel='noreferrer'
                className='document-listing-doc-link d-flex items-center content-center'
                aria-label='Open documentation'
                title='Open documentation'
            >
                <ExternalLink size={14} aria-hidden='true' />
            </a>
        );
    }, [docLink]);

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
                    className={gridClassName}
                    errorMessage={error}
                    isAccessDenied={isAccessDenied}
                    onRetry={refresh}
                    retryButtonText='Try again'
                />
            );
        }

        return (
            <Container ref={scrollContainerRef} className='document-listing-body-container overflow-auto flex-1'>
                <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    style={{ height: '100%' }}
                >
                    <DocumentListingTable
                        listingLabel={typeof title === 'string' ? title : undefined}
                        columns={columns}
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
                        compact={compact}
                    />
                </motion.div>
            </Container>
        );
    };

    return (
        <Container className={`d-flex column h-max document-listing-container color-secondary gap-1 ${compact ? 'is-compact' : ''}`}>
            <span style={VISUALLY_HIDDEN_STYLES} aria-live='polite' aria-atomic='true'>
                {sortAnnouncement}
            </span>
            {!hideHeader && (
                <Container className={`d-flex column ${gap}`}>  
                    <Container className='d-flex column gap-1-5 document-listing-header-top-container p-2'>
                        <Container className='d-flex content-between items-start gap-1-5'>
                            <Container className='document-listing-header-main d-flex gap-1 items-start'>
                                {isLoading && !data.length ? (
                                    <Container className='d-flex column gap-025'>
                                        <Skeleton variant='text' width={220} height={32} />
                                        {description ? <Skeleton variant='text' width={224} height={18} /> : null}
                                    </Container>
                                ) : (
                                    <Container className='document-listing-header-title-block d-flex column gap-025'>
                                        {typeof title === 'string' ? (
                                            <Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>{title}</Title>
                                        ) : (
                                            title
                                        )}
                                        {description ? (
                                            <Paragraph className='document-listing-header-description font-size-1 color-muted'>
                                                {description}
                                            </Paragraph>
                                        ) : null}
                                    </Container>
                                )}
                                {(headerDocLink || headerMenuTrigger) && (
                                    <Container className='d-flex gap-05 items-center'>
                                        {headerDocLink}
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
                                    </Container>
                                )}
                            </Container>
                            <Container className='d-flex gap-2 items-center'>
                                {headerActions}
                                {createNew && (
                                    <Button variant='solid' intent='brand' onClick={createNew.onCreate} leftIcon={<Plus size={18} />}>
                                        {createNew.buttonTitle}
                                    </Button>
                                )}
                            </Container>
                        </Container>
                    </Container>

                    {!hideTabs && resolvedTabs.length >= 2 && (
                        <Container>
                            <Container className='document-listing-header-tabs-container'>
                                <SegmentedTabs
                                    tabs={resolvedTabs}
                                    activeTab={activeTabId}
                                    onChange={handleTabChange}
                                    ariaLabel='Listing views'
                                    layoutId={`${persistenceKey}-tabs`}
                                />
                            </Container>
                            <Container className='document-listing-header-filters-container' />
                        </Container>
                    )}
                </Container>
            )}

            {renderContent()}
        </Container>
    );
};

export default DocumentListing;

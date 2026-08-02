import DocumentListingGrid from '@/shared/ui/components/DocumentListingGrid';
import DocumentListingHeader from '@/shared/ui/components/DocumentListing/DocumentListingHeader';
import DocumentListingTable, { getColumnKey } from '@/shared/ui/components/DocumentListingTable';
import useDocumentListingPagination from '@/shared/ui/hooks/use-document-listing-pagination';
import useListingViewPreferences from '@/shared/ui/components/DocumentListing/use-listing-view-preferences';
import useSocketQueryInvalidation from '@/modules/socket/hooks/use-socket-query-invalidation';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { describeSortState, getColumnAriaSort, getColumnSortIndicator } from '@/shared/ui/components/DocumentListing/sort-affordances';
import { isAccessDeniedCode } from '@/shared/errors/core';
import { sortData } from '@/shared/utils/sort';
import { Stack, usePrefersReducedMotion, VisuallyHidden } from '@voltstack/bravais';

import './DocumentListing.css';
import { motion } from 'framer-motion';
import { useCallback, useMemo, useRef } from 'react';
import { RiFileCopyLine } from 'react-icons/ri';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { DocumentListingCreateNew, DocumentListingTab } from '@/shared/ui/components/DocumentListing/DocumentListingHeader';
import type { DocumentListingDragAndDropConfig } from '@/shared/ui/components/DocumentListing/drag-and-drop';
import type { Identifiable } from '@/shared/contracts/entity';
import type { MenuOption } from '@/shared/contracts/menu';
import type { MouseEvent, ReactNode } from 'react';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/ui/hooks/use-pagination-params';
import type { QueryKey } from '@tanstack/react-query';

export type { DocumentListingTab } from '@/shared/ui/components/DocumentListing/DocumentListingHeader';

export interface SocketInvalidationConfig {
    event: string;
    queryKeys: QueryKey[];
};

type ViewMode = 'table' | 'grid';

interface DocumentListingProps<T extends Identifiable, TContext = Record<string, never>> {
    title: ReactNode;
    description?: ReactNode;
    queryKey: QueryKey;
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<T>>;
    transformData?: (data: T[]) => T[];
    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
    emptyMessage?: string;
    createNew?: DocumentListingCreateNew;
    headerActions?: ReactNode;
    headerMenuOptions?: MenuOption[];
    columns?: ColumnConfig<T>[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    onItemClick?: (item: T, event: MouseEvent) => boolean;
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
    view?: ViewMode;
    renderGridItem?: (item: T, index: number) => ReactNode;
    renderGridSkeleton?: () => ReactNode;
    gridBeforeContent?: ReactNode;
    gridClassName?: string;
    emptyIcon?: ReactNode;
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

const NO_INVALIDATION_RULES: SocketInvalidationConfig[] = [];

const COPY_DOCUMENT_ID_LABEL = 'Copy Document ID';

const DocumentListing = <T extends Identifiable, TContext = Record<string, never>>({
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const resolvedTabs = tabs?.length ? tabs : DEFAULT_TABS;
    const preferences = useListingViewPreferences({
        queryKey,
        columns,
        tabIds: resolvedTabs.map((tab) => tab.id),
        defaultTabId,
        onTabChange
    });
    const { sortConfig } = preferences;

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

    useSocketQueryInvalidation(socketInvalidation ?? NO_INVALIDATION_RULES, {
        enabled: Boolean(socketInvalidation?.length)
    });

    const wrappedGetMenuOptions = useCallback((item: T, selectedItems: T[]): MenuOption[] => {
        const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];

        if(!includeCopyDocumentId || menuOptions.some((option) => option.label === COPY_DOCUMENT_ID_LABEL)){
            return menuOptions;
        }

        return [
            ...menuOptions,
            {
                label: COPY_DOCUMENT_ID_LABEL,
                icon: RiFileCopyLine,
                onClick: async () => {
                    await copyTextToClipboard(item._id, {
                        successMessage: 'Document ID copied to clipboard',
                        errorMessage: 'Failed to copy document ID'
                    });
                }
            }
        ];
    }, [getMenuOptions, includeCopyDocumentId]);

    const sortedData = useMemo(() => sortData(data, sortConfig), [data, sortConfig]);

    const handleSort = (col: ColumnConfig<T>) => {
        const columnKey = getColumnKey(col);

        if(!col.sortable || !columnKey) return;

        preferences.toggleSort(columnKey);
    };

    const isAccessDenied = !!errorCode && isAccessDeniedCode(errorCode);

    /** Every prop both body renderers share, kept in one place so the two views cannot drift. */
    const bodyProps = {
        data: sortedData,
        isLoading,
        isFetchingMore,
        hasMore,
        onLoadMore: handleLoadMore,
        getMenuOptions: wrappedGetMenuOptions,
        dragAndDrop,
        emptyMessage,
        emptyButtonText,
        onEmptyButtonClick,
        errorMessage: error,
        isAccessDenied,
        onRetry: refresh,
        retryButtonText: 'Try again'
    };

    const renderContent = () => {
        if(view === 'grid'){
            if(!renderGridItem) return null;

            return (
                <DocumentListingGrid
                    {...bodyProps}
                    renderItem={renderGridItem}
                    renderSkeleton={renderGridSkeleton}
                    emptyIcon={emptyIcon}
                    emptyTitle={emptyTitle}
                    emptyButtonIsLoading={emptyButtonIsLoading}
                    beforeContent={gridBeforeContent}
                    className={gridClassName}
                />
            );
        }

        return (
            <div ref={scrollContainerRef} className='document-listing-body-container overflow-auto flex-1'>
                <motion.div
                    initial={prefersReducedMotion ? false : {
                        opacity: 0,
                        y: 15
                    }}
                    animate={prefersReducedMotion ? undefined : {
                        opacity: 1,
                        y: 0
                    }}
                    transition={prefersReducedMotion ? { duration: 0 } : {
                        duration: 0.4,
                        ease: [0.32, 0.72, 0, 1]
                    }}
                    style={{ height: '100%' }}
                >
                    <DocumentListingTable
                        {...bodyProps}
                        listingLabel={typeof title === 'string' ? title : undefined}
                        columns={preferences.visibleColumns}
                        onCellClick={handleSort}
                        getCellTitle={(col) => <>{col.title} {getColumnSortIndicator(col, sortConfig)}</>}
                        getAriaSort={(col) => getColumnAriaSort(col, sortConfig)}
                        onItemClick={onItemClick}
                        scrollContainerRef={scrollContainerRef}
                    />
                </motion.div>
            </div>
        );
    };

    return (
        <Stack height='max' gap='1' className='document-listing-container color-secondary'>
            <VisuallyHidden aria-live='polite' aria-atomic='true'>
                {describeSortState(columns, sortConfig)}
            </VisuallyHidden>
            {!hideHeader && (
                <DocumentListingHeader
                    title={title}
                    description={description}
                    showTitleSkeleton={isLoading && !data.length}
                    columns={columns}
                    showColumnPicker={view === 'table' && columns.length > 1}
                    headerActions={headerActions}
                    headerMenuOptions={headerMenuOptions}
                    createNew={createNew}
                    tabs={resolvedTabs}
                    hideTabs={hideTabs}
                    preferences={preferences}
                />
            )}

            {renderContent()}
        </Stack>
    );
};

export default DocumentListing;

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RxDotsHorizontal } from 'react-icons/rx';
import { Plus } from 'lucide-react';
import { Skeleton } from '@mui/material';
import useDocumentListingPagination, { UseDocumentListingPaginationProps } from '@/shared/presentation/hooks/use-document-listing-pagination';
import useOptimisticAction from '@/shared/presentation/hooks/use-optimistic-action';
import DocumentListingTable, { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListingTable';
import DocumentListingGrid from '@/shared/presentation/components/DocumentListingGrid';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { getValueByPath } from '@/shared/utils/format';
import { sortData } from '@/shared/utils/sort';
import { SortConfig } from '@/shared/domain/sorting/types';
import './DocumentListing.css';

export type { ColumnConfig, MenuOption };
export { getValueByPath };

type ViewMode = 'table' | 'grid';

interface DocumentListingBaseProps<T = unknown> {
    title: string | React.ReactNode;
    data: T[];
    emptyMessage?: string;
    createNew?: { buttonTitle: string; onCreate: () => void };
    headerActions?: React.ReactNode;
    gap?: string;
    // Table view props
    columns?: ColumnConfig[];
    onMenuAction?: (action: string, item: T) => void;
    getMenuOptions?: (item: T) => MenuOption[];
    // Grid view props
    view?: ViewMode;
    renderGridItem?: (item: T, index: number) => React.ReactNode;
    renderGridSkeleton?: () => React.ReactNode;
    gridClassName?: string;
    // Empty state props
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyButtonText?: string;
    emptyButtonIsLoading?: boolean;
    onEmptyButtonClick?: () => void;
    // Layout options
    hideHeader?: boolean;
    hideTabs?: boolean;
    // Manual pagination mode (client-side)
    isLoading?: boolean;
    isFetchingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
};

// Props when using fetch-based pagination
interface DocumentListingWithFetchProps<T, TContext> 
    extends DocumentListingBaseProps<T>, 
            UseDocumentListingPaginationProps<T, TContext> {};

// Props when using manual pagination
interface DocumentListingManualProps<T> extends DocumentListingBaseProps<T> {
    fetchData?: never;
    onDataFetched?: never;
    context?: never;
    onContextChange?: never;
    defaultLimit?: never;
    enabled?: never;
};

type DocumentListingProps<T, TContext = Record<string, never>> = 
    | DocumentListingWithFetchProps<T, TContext>
    | DocumentListingManualProps<T>;

const DocumentListing = <T, TContext = Record<string, never>>({
    title,
    columns = [],
    data = [],
    fetchData,
    onDataFetched,
    context,
    onContextChange,
    defaultLimit = 20,
    enabled = true,
    getMenuOptions,
    emptyMessage = 'No data available',
    createNew,
    headerActions,
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
    // Manual mode props
    isLoading: manualIsLoading,
    isFetchingMore: manualIsFetchingMore,
    hasMore: manualHasMore,
    onLoadMore: manualOnLoadMore
}: DocumentListingProps<T, TContext>) => {
    // Determine if we're using fetch-based or manual pagination
    const useFetchMode = !!fetchData && !!onDataFetched;

    // Use pagination hook only if in fetch mode
    const paginationHook = useDocumentListingPagination<T, TContext>({
        fetchData: fetchData || ((() => Promise.resolve({ status: 'success' as const, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false }})) as any),
        onDataFetched: onDataFetched || (() => {}),
        context,
        onContextChange,
        defaultLimit,
        enabled: useFetchMode ? enabled : false
    });

    // Resolve final values based on mode
    const isLoading = useFetchMode ? paginationHook.isLoading : (manualIsLoading || false);
    const isFetchingMore = useFetchMode ? paginationHook.isFetchingMore : (manualIsFetchingMore || false);
    const hasMore = useFetchMode ? paginationHook.hasMore : (manualHasMore || false);
    const error = useFetchMode ? paginationHook.error : null;
    const handleLoadMore = useFetchMode ? paginationHook.handleLoadMore : manualOnLoadMore;

    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    const { wrapMenuOptions, filterVisibleData } = useOptimisticAction<T>({
        shouldTrack: (opt) => opt.destructive === true
    });

    const wrappedGetMenuOptions = useCallback((item: T) => {
        if(!getMenuOptions) return [];
        return wrapMenuOptions(item, getMenuOptions(item));
    }, [getMenuOptions, wrapMenuOptions]);

    const visibleData = filterVisibleData(data);

    const sortedData = useMemo(() => {
        return sortData(visibleData, sortConfig, getValueByPath);
    }, [visibleData, sortConfig]);

    const handleSort = useCallback((col: ColumnConfig) => {
        if(!col.sortable) return;
        setSortConfig((prev) => {
            if(prev && prev.key === col.key){
                return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key: col.key, direction: 'asc' };
        });
    }, []);

    const getSortIndicator = useCallback((col: ColumnConfig) => {
        if(!col.sortable) return null;
        if(!sortConfig || sortConfig.key !== col.key) return <span className='sort-indicator'>⇅</span>;
        return sortConfig.direction === 'asc' ? <span className='sort-indicator'>↑</span> : <span className='sort-indicator'>↓</span>;
    }, [sortConfig]);

    const renderContent = () => {
        if(view === 'grid'){
            if(!renderGridItem) return null;

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
                    emptyMessage={error || emptyMessage}
                    emptyButtonText={emptyButtonText}
                    emptyButtonIsLoading={emptyButtonIsLoading}
                    onEmptyButtonClick={onEmptyButtonClick}
                    className={gridClassName}
                />
            );
        }

        return (
            <Container className='document-listing-body-container overflow-auto flex-1'>
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    style={{ height: '100%' }}
                >
                    <DocumentListingTable
                        columns={columns}
                        data={sortedData}
                        onCellClick={handleSort}
                        getCellTitle={(col) => <>{col.title} {getSortIndicator(col)}</>}
                        isLoading={isLoading && data.length === 0}
                        getMenuOptions={wrappedGetMenuOptions}
                        emptyMessage={error || emptyMessage}
                        hasMore={hasMore}
                        isFetchingMore={isFetchingMore}
                        onLoadMore={handleLoadMore}
                        emptyButtonText={emptyButtonText}
                        onEmptyButtonClick={onEmptyButtonClick}
                    />
                </motion.div>
            </Container>
        );
    };

    return (
        <Container className='d-flex column h-max document-listing-container color-primary'>
            {!hideHeader && (
                <Container className={`d-flex column ${gap}`}>
                    <Container className='d-flex column gap-1-5 document-listing-header-top-container'>
                        <Container className='d-flex content-between items-center'>
                            <Container className='d-flex gap-1-5 items-center'>
                                {isLoading && !data.length ? (
                                    <Skeleton variant='text' width={220} height={32} />
                                ) : typeof title === 'string' ? (
                                    <Title className='font-size-6 font-weight-5 sm:font-size-4'>{title}</Title>
                                ) : (
                                    title
                                )}
                                <i><RxDotsHorizontal /></i>
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

                    {!hideTabs && (
                        <Container>
                            <Container className='d-flex w-max gap-1 document-listing-header-tabs-container'>
                                <Container className='d-flex items-center gap-1 color-secondary document-listing-header-tab-container'>
                                    <Paragraph>{view === 'grid' ? 'Grid' : 'List'}</Paragraph>
                                </Container>
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

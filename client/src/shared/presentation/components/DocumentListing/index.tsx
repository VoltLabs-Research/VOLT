import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RxDotsHorizontal } from 'react-icons/rx';
import { Plus } from 'lucide-react';
import { Skeleton } from '@mui/material';
import useDocumentListingPagination from '@/shared/presentation/hooks/use-document-listing-pagination';
import { createListSyncConfig, type ListSyncConfig } from '@/shared/presentation/hooks/use-list-sync';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import useOptimisticAction from '@/shared/presentation/hooks/use-optimistic-action';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import DocumentListingTable, { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListingTable';
import DocumentListingGrid from '@/shared/presentation/components/DocumentListingGrid';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import ApiError from '@/shared/errors/ApiError';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { getValueByPath } from '@/shared/utils/format';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { sortData } from '@/shared/utils/sort';
import { SortConfig } from '@/shared/domain/sorting/types';
import { ExportType } from '@/shared/domain/export/types';
import { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import './DocumentListing.css';

export type { ColumnConfig, MenuOption };
export { createListSyncConfig };
export { getValueByPath };

type ViewMode = 'table' | 'grid';
type HeaderTabMode = 'list' | 'export';

export interface DocumentListingExportParams<TContext = Record<string, never>> {
    format: ExportType;
    context?: TContext;
    search: string;
    sort?: SortConfig | null;
}

interface DocumentListingExportConfig<TContext = Record<string, never>> {
    onExport?: (params: DocumentListingExportParams<TContext>) => Promise<Blob | void>;
    getFilename?: (format: ExportType) => string;
}

interface DocumentListingProps<T, TContext = Record<string, never>> {
    title: string | React.ReactNode;
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<T>>;
    transformData?: (data: T[]) => T[];
    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
    emptyMessage?: string;
    createNew?: { buttonTitle: string; onCreate: () => void };
    headerActions?: React.ReactNode;
    gap?: string;
    // Table view props
    columns?: ColumnConfig[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
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
    exportConfig?: DocumentListingExportConfig<TContext>;
    onHideItemRef?: React.MutableRefObject<((id: string) => void) | null>;
    listSyncConfig?: ListSyncConfig;
};

const DocumentListing = <T extends { _id: string }, TContext = Record<string, never>>({
    title,
    fetchData,
    transformData,
    context,
    defaultLimit = 20,
    enabled = true,
    columns = [],
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
    exportConfig,
    onHideItemRef,
    listSyncConfig
}: DocumentListingProps<T, TContext>) => {
    const getColumnSortKey = useCallback((col: ColumnConfig): string => {
        return String(col.key ?? (col as any).path ?? '');
    }, []);

    const {
        data,
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        errorCode,
        handleLoadMore,
        refresh,
        search
    } = useDocumentListingPagination<T, TContext>({
        fetchData,
        transformData,
        context,
        defaultLimit,
        enabled,
        listSyncConfig
    });

    // F5 keyboard shortcut to refresh data instead of reloading the page
    useKeyboardShortcut('F5', refresh);

    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [activeTab, setActiveTab] = useState<HeaderTabMode>('list');
    const [selectedExportType, setSelectedExportType] = useState<ExportType>('json');
    const [isExporting, setIsExporting] = useState(false);

    const exportModalId = useMemo(() => `document-listing-export-${Math.random().toString(36).slice(2)}`, []);

    const { addToHidden, wrapMenuOptions, filterVisibleData } = useOptimisticAction<T>({
        shouldTrack: (opt) => opt.destructive === true
    });

    useEffect(() => {
        if(onHideItemRef){
            onHideItemRef.current = addToHidden;
        }
        return () => {
            if(onHideItemRef){
                onHideItemRef.current = null;
            }
        };
    }, [onHideItemRef, addToHidden]);

    const wrappedGetMenuOptions = useCallback((item: T, selectedItems: T[]) => {
        if(!getMenuOptions) return [];
        const selectedIds = new Set(selectedItems.map((selectedItem) => selectedItem._id));
        const targetItems = selectedIds.has(item._id) ? selectedItems : [item];
        return wrapMenuOptions(item, targetItems, getMenuOptions(item, selectedItems));
    }, [getMenuOptions, wrapMenuOptions]);

    const visibleData = filterVisibleData(data);

    const sortedData = useMemo(() => {
        return sortData(visibleData, sortConfig, getValueByPath);
    }, [visibleData, sortConfig]);

    const handleSort = useCallback((col: ColumnConfig) => {
        if(!col.sortable) return;
        const columnKey = getColumnSortKey(col);
        if (!columnKey) return;
        setSortConfig((prev) => {
            if(prev && prev.key === columnKey){
                return { key: columnKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key: columnKey, direction: 'asc' };
        });
    }, [getColumnSortKey]);

    const getSortIndicator = useCallback((col: ColumnConfig) => {
        if(!col.sortable) return null;
        const columnKey = getColumnSortKey(col);
        if(!sortConfig || sortConfig.key !== columnKey) return <span className='sort-indicator'>⇅</span>;
        return sortConfig.direction === 'asc' ? <span className='sort-indicator'>↑</span> : <span className='sort-indicator'>↓</span>;
    }, [sortConfig, getColumnSortKey]);

    const handleTabChange = useCallback((tab: HeaderTabMode) => {
        setActiveTab(tab);
        if (tab === 'export') {
            openModal(exportModalId);
        }
    }, [exportModalId]);

    const handleConfirmExport = useCallback(async () => {
        if (!exportConfig?.onExport) {
            sileo.error({ title: 'Export is not available for this module yet' });
            return;
        }

        setIsExporting(true);
        try {
            await showPromise(
                (async () => {
                    const result = await exportConfig.onExport!({
                        format: selectedExportType,
                        context,
                        search,
                        sort: sortConfig
                    });

                    if (result instanceof Blob) {
                        const filename = exportConfig.getFilename?.(selectedExportType)
                            ?? `listing-export.${selectedExportType}`;
                        triggerBrowserDownload(result, filename);
                    }
                    return result;
                })(),
                {
                    loading: { title: 'Generating export...' },
                    success: { title: 'Export generated successfully' },
                    error: { title: 'Failed to export listing' }
                }
            );
            closeModal(exportModalId);
            setActiveTab('list');
        } finally {
            setIsExporting(false);
        }
    }, [exportConfig, selectedExportType, context, search, sortConfig, exportModalId]);

    const isAccessDenied = !!errorCode && ApiError.isCodePermissionDenied(errorCode);

    const renderContent = () => {
        if(isAccessDenied){
            return <AccessDenied description={error || undefined} showBack={false} />;
        }

        const emptyMessageText = error ? error : emptyMessage;
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
                    emptyMessage={emptyMessageText}
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
                        isLoading={isLoading}
                        getMenuOptions={wrappedGetMenuOptions}
                        emptyMessage={emptyMessageText}
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
                    <Container className='d-flex column gap-1-5 document-listing-header-top-container p-2'>
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
                                <Container
                                    className={`d-flex items-center gap-1 color-secondary document-listing-header-tab-container d-flex flex-center ${activeTab === 'list' ? 'is-active' : ''}`}
                                    onClick={() => handleTabChange('list')}
                                >
                                    <Paragraph>{view === 'grid' ? 'Grid' : 'List'}</Paragraph>
                                </Container>
                                <Container
                                    className={`d-flex items-center gap-1 color-secondary document-listing-header-tab-container d-flex flex-center ${activeTab === 'export' ? 'is-active' : ''}`}
                                    onClick={() => handleTabChange('export')}
                                >
                                    <Paragraph>Export</Paragraph>
                                </Container>
                            </Container>
                            <Container className='document-listing-header-filters-container' />
                        </Container>
                    )}
                </Container>
            )}

            {renderContent()}

            <Modal
                id={exportModalId}
                title='Export listing'
                description='Choose a format to export all matching records with the current listing scope.'
                footer={(
                    <>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            onClick={() => {
                                closeModal(exportModalId);
                                setActiveTab('list');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant='solid'
                            intent='brand'
                            isLoading={isExporting}
                            onClick={handleConfirmExport}
                        >
                            Export
                        </Button>
                    </>
                )}
            >
                <Container className='p-1-5'>
                    <FormField
                        label='Format'
                        fieldType='select'
                        variant='inline'
                        options={[
                            { title: 'JSON', value: 'json' },
                            { title: 'CSV', value: 'csv' }
                        ]}
                        value={selectedExportType}
                        onChange={(event) => setSelectedExportType(event.target.value as ExportType)}
                    />
                </Container>
            </Modal>
        </Container>
    );
};

export default DocumentListing;

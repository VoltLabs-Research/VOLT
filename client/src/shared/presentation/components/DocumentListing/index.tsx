import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import type { ExportType } from '@/shared/domain/export/types';
import { getValueByPath } from '@/shared/utils/format';
import { isAccessDeniedCode } from '@/shared/errors/notify-api-error';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { SortConfig } from '@/shared/domain/sorting/types';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { sortData } from '@/shared/utils/sort';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import queryClient from '@/shared/infrastructure/query/query-client';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import AsyncMenuItemWrapper from '@/shared/presentation/components/AsyncMenuItemWrapper';
import DocumentListingGrid from '@/shared/presentation/components/DocumentListingGrid';
import DocumentListingTable from '@/shared/presentation/components/DocumentListingTable';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import Title from '@/shared/presentation/components/Title';
import useDocumentListingPagination from '@/shared/presentation/hooks/use-document-listing-pagination';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import useOptimisticAction from '@/shared/presentation/hooks/use-optimistic-action';
import './DocumentListing.css';
import { Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { RxDotsHorizontal } from 'react-icons/rx';
import { sileo } from 'sileo';
import React from 'react';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { QueryKey } from '@tanstack/react-query';

export type { ColumnConfig, MenuOption };
export { getValueByPath };

export interface SocketInvalidationConfig {
    event: string;
    queryKeys: QueryKey[];
};

export enum DocumentListingTabAction {
    View = 'view',
    Export = 'export'
};

export interface DocumentListingTab {
    id: string;
    label: string;
    action?: DocumentListingTabAction;
};

type ViewMode = 'table' | 'grid';

export interface DocumentListingExportParams<TContext = Record<string, never>> {
    format: ExportType;
    context?: TContext;
    search: string;
    sort?: SortConfig | null;
};

interface DocumentListingExportConfig<TContext = Record<string, never>> {
    onExport?: (params: DocumentListingExportParams<TContext>) => Promise<Blob | void>;
    getFilename?: (format: ExportType) => string;
};

interface DocumentListingProps<T extends { _id: string }, TContext = Record<string, never>> {
    title: string | React.ReactNode;
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
    // Table view props
    columns?: ColumnConfig<T>[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    onItemClick?: (item: T, event: React.MouseEvent) => boolean;
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
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
    tabs?: DocumentListingTab[];
    defaultTabId?: string;
    onTabChange?: (tabId: string) => void;
    exportConfig?: DocumentListingExportConfig<TContext>;
    onHideItemRef?: React.MutableRefObject<((id: string) => void) | null>;
    socketInvalidation?: SocketInvalidationConfig[];
    compact?: boolean;
};

interface ExportTypeOption {
    title: string;
    value: ExportType;
};

const DEFAULT_TABS: DocumentListingTab[] = [
    {
        id: 'list',
        label: 'List',
        action: DocumentListingTabAction.View
    },
    {
        id: 'export',
        label: 'Export',
        action: DocumentListingTabAction.Export
    }
];

const EXPORT_TYPE_OPTIONS: ExportTypeOption[] = [
    {
        title: 'JSON',
        value: 'json'
    },
    {
        title: 'CSV',
        value: 'csv'
    }
];

const isExportType = (value: string): value is ExportType => {
    return value === 'json' || value === 'csv';
};

const resolveInitialTabId = (tabs: DocumentListingTab[], preferredTabId?: string): string => {
    if (preferredTabId && tabs.some((tab) => tab.id === preferredTabId)) {
        return preferredTabId;
    }

    const firstViewTab = tabs.find((tab) => tab.action !== DocumentListingTabAction.Export);
    return firstViewTab?.id || tabs[0]?.id || 'list';
};

const DocumentListing = <T extends { _id: string }, TContext = Record<string, never>>({
    title,
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
    exportConfig,
    onHideItemRef,
    socketInvalidation,
    compact = false
}: DocumentListingProps<T, TContext>) => {
    const socketService = useSocket();
    const resolvedTabs = useMemo(() => {
        return tabs?.length ? tabs : DEFAULT_TABS;
    }, [tabs]);
    const initialTabId = useMemo(() => {
        return resolveInitialTabId(resolvedTabs, defaultTabId);
    }, [defaultTabId, resolvedTabs]);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [activeTabId, setActiveTabId] = useState(initialTabId);
    const [lastContentTabId, setLastContentTabId] = useState(initialTabId);
    const [selectedExportType, setSelectedExportType] = useState<ExportType>('json');
    const [isExporting, setIsExporting] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setActiveTabId(initialTabId);
        setLastContentTabId(initialTabId);
    }, [initialTabId]);

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
        refresh,
        search
    } = useDocumentListingPagination<T, TContext>({
        queryKey,
        fetchData,
        transformData,
        context,
        defaultLimit,
        enabled
    });

    useEffect(() => {
        if (!socketInvalidation?.length) {
            return;
        }

        const unsubscribers = socketInvalidation.map(({ event, queryKeys: invalidationQueryKeys }) => {
            return socketService.on(event, () => {
                Promise.allSettled(
                    invalidationQueryKeys.map((currentQueryKey) => queryClient.invalidateQueries({ queryKey: currentQueryKey }))
                );
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [socketService, socketInvalidation]);

    useKeyboardShortcut('F5', refresh);

    const exportModalId = useMemo(() => `document-listing-export-${Math.random().toString(36).slice(2)}`, []);

    const { addToHidden, wrapMenuOptions, filterVisibleData } = useOptimisticAction<T>({
        shouldTrack: (opt) => opt.destructive === true
    });

    useEffect(() => {
        if (onHideItemRef) {
            onHideItemRef.current = addToHidden;
        }

        return () => {
            if (onHideItemRef) {
                onHideItemRef.current = null;
            }
        };
    }, [onHideItemRef, addToHidden]);

    const wrappedGetMenuOptions = useCallback((item: T, selectedItems: T[]) => {
        if (!getMenuOptions) {
            return [];
        }

        const selectedIds = new Set(selectedItems.map((selectedItem) => selectedItem._id));
        const targetItems = selectedIds.has(item._id) ? selectedItems : [item];
        return wrapMenuOptions(item, targetItems, getMenuOptions(item, selectedItems));
    }, [getMenuOptions, wrapMenuOptions]);

    const visibleData = filterVisibleData(data);

    const sortedData = useMemo(() => {
        return sortData(visibleData, sortConfig, getValueByPath);
    }, [visibleData, sortConfig]);

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
        if (!sortConfig || sortConfig.key !== columnKey) {
            return <span className='sort-indicator'>⇅</span>;
        }

        return sortConfig.direction === 'asc'
            ? <span className='sort-indicator'>↑</span>
            : <span className='sort-indicator'>↓</span>;
    }, [getColumnSortKey, sortConfig]);

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

    const resetToLastContentTab = useCallback(() => {
        setActiveTabId(lastContentTabId);
    }, [lastContentTabId]);

    const handleTabChange = useCallback((tabId: string) => {
        const targetTab = resolvedTabs.find((tab) => tab.id === tabId);
        if (!targetTab) {
            return;
        }

        setActiveTabId(targetTab.id);

        if (targetTab.action === DocumentListingTabAction.Export) {
            openModal(exportModalId);
            return;
        }

        setLastContentTabId(targetTab.id);
        onTabChange?.(targetTab.id);
    }, [exportModalId, onTabChange, resolvedTabs]);

    const handleConfirmExport = useCallback(async () => {
        const onExport = exportConfig?.onExport;
        if (!onExport) {
            sileo.error({ title: 'Export is not available for this module yet' });
            resetToLastContentTab();
            return;
        }

        setIsExporting(true);
        try {
            await showPromise(
                (async () => {
                    const result = await onExport({
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
            resetToLastContentTab();
        } finally {
            setIsExporting(false);
        }
    }, [context, exportConfig, exportModalId, resetToLastContentTab, search, selectedExportType, sortConfig]);

    const handleExportTypeChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        if (isExportType(value)) {
            setSelectedExportType(value);
        }
    }, []);

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
        <Container className={`d-flex column h-max document-listing-container color-secondary ${compact ? 'is-compact' : ''}`}>
            {!hideHeader && (
                <Container className={`d-flex column ${gap}`}>
                    <Container className='d-flex column gap-1-5 document-listing-header-top-container p-2'>
                        <Container className='d-flex content-between items-center'>
                            <Container className='d-flex gap-1-5 items-center'>
                                {isLoading && !data.length ? (
                                    <Skeleton variant='text' width={220} height={32} />
                                ) : typeof title === 'string' ? (
                                    <Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>{title}</Title>
                                ) : (
                                    title
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
                                {resolvedTabs.map((tab) => (
                                    <Container
                                        key={tab.id}
                                        className={`d-flex items-center gap-1 color-secondary document-listing-header-tab-container d-flex flex-center ${activeTabId === tab.id ? 'is-active' : ''}`}
                                        onClick={() => handleTabChange(tab.id)}
                                    >
                                        <Paragraph>{tab.label}</Paragraph>
                                    </Container>
                                ))}
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
                    <ModalFooterActions
                        secondary={{
                            label: 'Cancel',
                            onClick: () => {
                                closeModal(exportModalId);
                                resetToLastContentTab();
                            }
                        }}
                        primary={{
                            label: 'Export',
                            isLoading: isExporting,
                            onClick: handleConfirmExport
                        }}
                    />
                )}
            >
                <Container className='p-1-5'>
                    <FormFieldRHF
                        label='Format'
                        fieldType='select'
                        variant='inline'
                        options={EXPORT_TYPE_OPTIONS}
                        value={selectedExportType}
                        onChange={handleExportTypeChange}
                    />
                </Container>
            </Modal>
        </Container>
    );
};

export default DocumentListing;

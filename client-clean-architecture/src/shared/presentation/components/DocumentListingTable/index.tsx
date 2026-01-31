import React, { useRef, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@mui/material';
import { FileText } from 'lucide-react';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import './DocumentListingTable.css';

const MIN_COLUMN_WIDTH = 180;
const MAX_COLUMN_WIDTH = 280;
const COLUMN_GAP = 16;

export interface ColumnConfig {
    key: string;
    title: string;
    render?: (value: unknown, row?: unknown) => React.ReactNode;
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number };
    sortable?: boolean;
};

type MenuOptionTuple = [label: string, Icon: React.ComponentType, onClick: () => void];
type MenuOptionObject = {
    label: string;
    icon?: React.ComponentType;
    onClick: () => void;
    destructive?: boolean;
};
export type MenuOption = MenuOptionTuple | MenuOptionObject;

interface DocumentListingTableProps {
    columns: ColumnConfig[];
    data: unknown[];
    onCellClick?: (col: ColumnConfig) => void;
    getCellTitle?: (col: ColumnConfig) => React.ReactNode;
    isLoading?: boolean;
    getMenuOptions?: (item: unknown) => MenuOption[];
    emptyMessage?: string;
    hasMore?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    skeletonRowsCount?: number;
    scrollContainerRef?: React.RefObject<HTMLElement> | null;
    keyExtractor?: (item: unknown, index: number) => string | number;
    emptyButtonText?: string;
    onEmptyButtonClick?: () => void;
};

const getColumnWidth = (col: ColumnConfig): number => {
    const titleLength = col.title?.length ?? 10;
    return Math.max(MIN_COLUMN_WIDTH, Math.min(titleLength * 14, MAX_COLUMN_WIDTH));
};

const AsyncMenuItemWrapper = ({ option }: { option: MenuOption }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async (onClick: () => void) => {
        try{
            setIsLoading(true);
            await onClick();
        }catch(error){
            console.error(error);
        }finally{
            setIsLoading(false);
        }
    };

    if(Array.isArray(option)){
        const [label, Icon, onClick] = option;
        return (
            <PopoverMenuItem
                icon={<Icon />}
                onClick={() => handleClick(onClick)}
                isLoading={isLoading}
            >
                {label}
            </PopoverMenuItem>
        );
    }

    const Icon = option.icon;
    return (
        <PopoverMenuItem
            icon={Icon ? <Icon /> : undefined}
            onClick={() => handleClick(option.onClick)}
            variant={option.destructive ? 'danger' : 'default'}
            isLoading={isLoading}
        >
            {option.label}
        </PopoverMenuItem>
    );
};

interface RowProps {
    item: unknown;
    index: number;
    columns: ColumnConfig[];
    columnWidths: number[];
    getMenuOptions?: (item: unknown) => MenuOption[];
    keyExtractor?: (item: unknown, index: number) => string | number;
    useFlexDistribution: boolean;
};

const TableRow = ({ item, index, columns, columnWidths, getMenuOptions, keyExtractor, useFlexDistribution }: RowProps) => {
    const rowKey = keyExtractor ? keyExtractor(item, index) : `item-${index}`;
    const menuOptions = getMenuOptions ? getMenuOptions(item) : [];
    const itemRecord = item as Record<string, unknown>;

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start',
        gap: useFlexDistribution ? undefined : `${COLUMN_GAP}px`
    };

    const content = (
        <motion.button
            type='button'
            style={rowStyle}
            className='document-listing-table-row-container cursor-pointer w-max'
            transition={{ duration: 0.1 }}
        >
            {columns.map((col, colIdx) => {
                const cellValue = itemRecord?.[col.key];
                const title = String(cellValue ?? '');

                return (
                    <div
                        className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                        data-label={col.title}
                        key={`cell-${col.title}-${colIdx}`}
                        title={title}
                        style={
                            useFlexDistribution
                                ? { flex: 1, minWidth: 0 }
                                : { width: columnWidths[colIdx], minWidth: columnWidths[colIdx], maxWidth: columnWidths[colIdx], flexShrink: 0 }
                        }
                    >
                        <span className='document-listing-cell-value'>
                            {col.render ? col.render(cellValue, item) : String(cellValue ?? '-')}
                        </span>
                    </div>
                );
            })}
        </motion.button>
    );

    if(menuOptions.length === 0) return content;

    return (
        <Popover id={`row-menu-${rowKey}`} trigger={content}>
            {menuOptions.map((option, idx) => (
                <AsyncMenuItemWrapper key={idx} option={option} />
            ))}
        </Popover>
    );
};

const SkeletonRow = ({ columns, columnWidths, useFlexDistribution }: { columns: ColumnConfig[]; columnWidths?: number[]; useFlexDistribution?: boolean }) => (
    <div
        className='document-listing-table-row-container skeleton-row d-flex'
        style={{
            gap: useFlexDistribution ? undefined : `${COLUMN_GAP}px`,
            justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
        }}
    >
        {columns.map((col, colIdx) => (
            <div
                className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                data-label={col.title}
                key={col.key}
                style={
                    useFlexDistribution
                        ? { flex: 1, minWidth: 0 }
                        : columnWidths
                            ? { width: columnWidths[colIdx], minWidth: columnWidths[colIdx], flexShrink: 0 }
                            : { flex: 1 }
                }
            >
                <span className='document-listing-cell-value'>
                    <Skeleton
                        {...(col.skeleton ?? { variant: 'text', width: 100 })}
                        animation='wave'
                        sx={{ bgcolor: 'rgba(0, 0, 0, 0.06)', borderRadius: col.skeleton?.variant === 'rounded' ? '12px' : '4px' }}
                    />
                </span>
            </div>
        ))}
    </div>
);

const DocumentListingTable: React.FC<DocumentListingTableProps> = ({
    columns,
    data,
    onCellClick = () => {},
    getCellTitle = (col) => col.title,
    isLoading = false,
    getMenuOptions,
    emptyMessage = 'No documents to show.',
    hasMore = false,
    isFetchingMore = false,
    onLoadMore,
    skeletonRowsCount = 8,
    scrollContainerRef = null,
    keyExtractor,
    emptyButtonText,
    onEmptyButtonClick
}) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const bodyRef = useRef<HTMLDivElement | null>(null);

    const columnWidths = useMemo(() => columns.map(getColumnWidth), [columns]);
    const minContentWidth = useMemo(() => {
        const sum = columnWidths.reduce((acc, w) => acc + w, 0);
        return sum + (columns.length - 1) * COLUMN_GAP;
    }, [columnWidths, columns.length]);

    const useFlexDistribution = useMemo(() => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const availableWidth = viewportWidth - 350;
        return availableWidth >= minContentWidth;
    }, [minContentWidth]);

    const effectiveWidth = useFlexDistribution ? '100%' : `${minContentWidth}px`;

    useEffect(() => {
        const root = scrollContainerRef && 'current' in scrollContainerRef ? scrollContainerRef.current : null;
        const sentinel = sentinelRef.current;
        if(!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if(entry?.isIntersecting && hasMore && !isFetchingMore) onLoadMore?.();
            },
            { root: root ?? null, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [scrollContainerRef, hasMore, isFetchingMore, onLoadMore]);

    const isInitialLoading = isLoading && data.length === 0;
    const hasNoData = data.length === 0;
    const shouldShowEmptyState = hasNoData && !isLoading;

    return (
        <Container className='d-flex column document-listing-table-container h-max'>
            {columns.length > 0 && !shouldShowEmptyState && (
                <div
                    className='document-listing-table-header-container p-sticky d-flex'
                    style={{
                        width: effectiveWidth,
                        gap: useFlexDistribution ? undefined : `${COLUMN_GAP}px`,
                        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
                    }}
                >
                    {columns.map((col, colIdx) => (
                        <div
                            className={`document-listing-cell header-cell ${col.sortable ? 'sortable cursor-pointer' : ''} overflow-hidden d-flex items-center color-primary`}
                            key={`header-${col.title}-${colIdx}`}
                            onClick={() => onCellClick(col)}
                            style={
                                useFlexDistribution
                                    ? { flex: 1, minWidth: 0 }
                                    : { width: columnWidths[colIdx], minWidth: columnWidths[colIdx], maxWidth: columnWidths[colIdx], flexShrink: 0 }
                            }
                        >
                            <Title className='font-size-2-5 font-weight-5 color-secondary'>{getCellTitle(col)}</Title>
                        </div>
                    ))}
                </div>
            )}

            <Container
                ref={bodyRef as React.RefObject<HTMLDivElement>}
                className='d-flex column p-relative document-listing-table-body-container flex-1 overflow-hidden'
                style={{ minWidth: useFlexDistribution ? undefined : `${minContentWidth}px` }}
            >
                {!hasNoData && data.map((item, idx) => (
                    <TableRow
                        key={keyExtractor ? keyExtractor(item, idx) : `item-${idx}`}
                        item={item}
                        index={idx}
                        columns={columns}
                        columnWidths={columnWidths}
                        getMenuOptions={getMenuOptions}
                        keyExtractor={keyExtractor}
                        useFlexDistribution={useFlexDistribution}
                    />
                ))}

                {isFetchingMore && Array.from({ length: skeletonRowsCount }).map((_, i) => (
                    <SkeletonRow key={`fetching-${i}`} columns={columns} columnWidths={columnWidths} useFlexDistribution={useFlexDistribution} />
                ))}

                <div ref={sentinelRef} style={{ height: 1 }} />

                {shouldShowEmptyState && (
                    <div className='document-listing-overlay-blur p-absolute'>
                        <div className='document-listing-empty-content p-absolute d-flex items-center content-center'>
                            <Container className='d-flex column items-center gap-1-5' style={{ maxWidth: '320px' }}>
                                <Container
                                    className='d-flex items-center content-center'
                                    style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-zinc-800)' }}
                                >
                                    <FileText size={26} strokeWidth={1.5} style={{ color: 'var(--color-zinc-400)' }} />
                                </Container>
                                <Container className='d-flex column gap-05 text-center'>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-zinc-100)' }}>Nothing here yet</span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--color-zinc-500)', lineHeight: 1.5 }}>{emptyMessage}</span>
                                </Container>
                                {emptyButtonText && onEmptyButtonClick && (
                                    <Button variant='solid' intent='brand' size='sm' onClick={onEmptyButtonClick} style={{ marginTop: '0.5rem' }}>
                                        {emptyButtonText}
                                    </Button>
                                )}
                            </Container>
                        </div>
                    </div>
                )}

                {isInitialLoading && (
                    <div className='document-listing-overlay-blur p-absolute'>
                        <div className='document-listing-infinite-skeleton-loader p-absolute overflow-hidden d-flex column'>
                            {Array.from({ length: 20 }).map((_, index) => (
                                <SkeletonRow key={`loading-skeleton-${index}`} columns={columns} columnWidths={columnWidths} useFlexDistribution={useFlexDistribution} />
                            ))}
                        </div>
                    </div>
                )}
            </Container>

            <div className='document-listing-table-footer-container' />
        </Container>
    );
};

export default DocumentListingTable;

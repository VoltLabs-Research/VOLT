import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RxDotsHorizontal } from 'react-icons/rx';
import { Plus } from 'lucide-react';
import { Skeleton } from '@mui/material';
import useListingLifecycle, { type FetchParams } from '@/shared/presentation/hooks/use-listing-lifecycle';
import type { ListingMeta } from '@/shared/domain/entities/ListingMeta';
import DocumentListingTable, { type ColumnConfig, type MenuOption } from '@/shared/presentation/components/DocumentListingTable';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { getValueByPath } from '@/shared/utils/format';
import './DocumentListing.css';

export type { ColumnConfig, MenuOption };
export { getValueByPath };

const sortDataWorker = (data: unknown[], sortConfig: { key: string; direction: 'asc' | 'desc' } | null): unknown[] => {
    const toSearchString = (val: unknown): string => {
        if(val == null) return '';
        const t = typeof val;
        if(t === 'string' || t === 'number' || t === 'boolean') return String(val);
        if(Array.isArray(val)) return val.map((v) => toSearchString(v)).join(' ');
        if(t === 'object'){
            const preferredKeys = ['name', 'title', '_id', 'id'];
            const parts: string[] = [];
            try{
                for(const k of preferredKeys){
                    if(k in (val as object) && (val as Record<string, unknown>)[k] != null){
                        parts.push(String((val as Record<string, unknown>)[k]));
                    }
                }
                if(parts.length) return parts.join(' ');
                return Object.values(val as object).map((v) => toSearchString(v)).join(' ');
            }catch{
                return '';
            }
        }
        return '';
    };

    if(!sortConfig) return data;

    const workingData = [...data];
    workingData.sort((a, b) => {
        const aVal = getValueByPath(a, sortConfig.key);
        const bVal = getValueByPath(b, sortConfig.key);

        if(aVal == null && bVal == null) return 0;
        if(aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
        if(bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;

        const aStr = toSearchString(aVal);
        const bStr = toSearchString(bVal);

        const aNum = Number(aStr);
        const bNum = Number(bStr);
        const bothNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum);

        if(bothNumeric){
            return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return workingData;
};

interface DocumentListingProps {
    title: string | React.ReactNode;
    columns: ColumnConfig[];
    data: unknown[];
    isLoading?: boolean;
    onMenuAction?: (action: string, item: unknown) => void;
    getMenuOptions?: (item: unknown) => MenuOption[];
    emptyMessage?: string;
    keyExtractor?: (item: unknown, index: number) => string | number;
    hasMore?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    createNew?: { buttonTitle: string; onCreate: () => void };
    headerActions?: React.ReactNode;
    gap?: string;
    fetchData?: (params: FetchParams) => Promise<void> | void;
    listingMeta?: ListingMeta;
    dependencies?: unknown[];
    initialFetchParams?: Record<string, unknown>;
};

const DocumentListing: React.FC<DocumentListingProps> = ({
    title,
    columns = [],
    data = [],
    isLoading = false,
    getMenuOptions,
    emptyMessage = 'No data available',
    keyExtractor = (item, index) => (item as Record<string, unknown>)?._id as string ?? (item as Record<string, unknown>)?.id as string ?? index,
    hasMore,
    isFetchingMore,
    onLoadMore,
    createNew,
    headerActions,
    gap = 'gap-3',
    fetchData,
    listingMeta,
    dependencies = [],
    initialFetchParams
}) => {
    const { handleLoadMore: hookLoadMore } = useListingLifecycle({
        data,
        isLoading,
        isFetchingMore: !!isFetchingMore,
        listingMeta: listingMeta || { page: 1, limit: 20, hasMore: hasMore || false, total: 0 },
        fetchData: fetchData || (() => {}),
        dependencies,
        initialFetchParams,
        skipInitialFetch: !fetchData
    });

    const activeLoadMore = fetchData ? hookLoadMore : onLoadMore;
    const activeHasMore = listingMeta ? listingMeta.hasMore : hasMore;

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState(new Set<string>());

    const wrappedGetMenuOptions = useCallback((item: unknown) => {
        if(!getMenuOptions) return [];
        const options = getMenuOptions(item);

        return options.map((opt: MenuOption) => {
            let label: string, Icon: React.ComponentType, onClick: () => void;
            let isArray = false;

            if(Array.isArray(opt)){
                [label, Icon, onClick] = opt;
                isArray = true;
            }else{
                label = opt.label;
                Icon = opt.icon as React.ComponentType;
                onClick = opt.onClick;
            }

            if(label === 'Delete' || label === 'Remove'){
                const originalOnClick = onClick;
                const wrappedOnClick = async () => {
                    const id = String(keyExtractor(item, 0));
                    setOptimisticallyDeletedIds((prev) => {
                        const next = new Set(prev);
                        next.add(id);
                        return next;
                    });

                    try{
                        await originalOnClick();
                    }catch(err){
                        setOptimisticallyDeletedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                        });
                        throw err;
                    }
                };

                if(isArray) return [label, Icon, wrappedOnClick] as MenuOption;
                return { ...opt, onClick: wrappedOnClick } as MenuOption;
            }

            return opt;
        });
    }, [getMenuOptions, keyExtractor]);

    const visibleData = useMemo(() => {
        return data.filter((item, index) => !optimisticallyDeletedIds.has(String(keyExtractor(item, index))));
    }, [data, optimisticallyDeletedIds, keyExtractor]);

    const sortedData = useMemo(() => {
        return sortDataWorker(visibleData, sortConfig);
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

    const bodyRef = useRef<HTMLDivElement | null>(null);

    return (
        <Container className='d-flex column h-max document-listing-container color-primary'>
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

                <Container>
                    <Container className='d-flex w-max gap-1 document-listing-header-tabs-container'>
                        <Container className='d-flex items-center gap-1 color-secondary document-listing-header-tab-container'>
                            <Paragraph>List</Paragraph>
                        </Container>
                    </Container>
                    <Container className='document-listing-header-filters-container' />
                </Container>
            </Container>

            <Container className='document-listing-body-container overflow-auto flex-1' ref={bodyRef as React.RefObject<HTMLDivElement>}>
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
                        emptyMessage={emptyMessage}
                        hasMore={activeHasMore}
                        isFetchingMore={isFetchingMore}
                        onLoadMore={activeLoadMore}
                        keyExtractor={keyExtractor}
                        scrollContainerRef={bodyRef as React.RefObject<HTMLElement>}
                    />
                </motion.div>
            </Container>
        </Container>
    );
};

export default DocumentListing;

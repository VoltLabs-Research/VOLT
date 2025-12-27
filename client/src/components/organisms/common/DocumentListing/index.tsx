import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { RxDotsHorizontal } from 'react-icons/rx'
import { Plus } from 'lucide-react'
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable'
import { Skeleton } from '@mui/material'
import './DocumentListing.css'
import Container from '@/components/primitives/Container'
import Button from '@/components/primitives/Button'
import DynamicIcon from '@/components/atoms/common/DynamicIcon'
import Title from '@/components/primitives/Title'
import Paragraph from '@/components/primitives/Paragraph'

// TODO: REFACTOR
const sortDataWorker = (
    data: any[],
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null
): any[] => {
    const getValueByPath = (obj: any, path: string) => {
        if (!obj || !path) return undefined
        if (path.indexOf('.') === -1) return obj?.[path]
        return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj)
    }

    const toSearchString = (val: any): string => {
        if (val == null) return ''
        const t = typeof val
        if (t === 'string' || t === 'number' || t === 'boolean') return String(val)
        if (Array.isArray(val)) return val.map((v) => toSearchString(v)).join(' ')
        if (t === 'object') {
            const preferredKeys = ['name', 'title', 'identificationMode', 'crystalStructure', 'method', '_id', 'id']
            const parts: string[] = []
            try {
                for (const k of preferredKeys) {
                    if (k in val && val[k] != null) parts.push(String(val[k]))
                }
                if (parts.length) return parts.join(' ')
                return Object.values(val).map((v) => toSearchString(v)).join(' ')
            } catch (_e) {
                return ''
            }
        }
        return ''
    }

    if (!sortConfig) return data

    const workingData = [...data]
    workingData.sort((a, b) => {
        const aVal = getValueByPath(a, sortConfig.key)
        const bVal = getValueByPath(b, sortConfig.key)

        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1
        if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1

        const aStr = toSearchString(aVal)
        const bStr = toSearchString(bVal)

        const aNum = Number(aStr)
        const bNum = Number(bStr)
        const bothNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum)

        if (bothNumeric) {
            return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
        }

        return sortConfig.direction === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr)
    })

    return workingData
};

export type ColumnConfig = {
    key: string
    title: string
    render?: (value: any, row?: any) => React.ReactNode
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number }
    sortable?: boolean
}

export const formatNumber = (num: number) => {
    if (num === 0) return '0'
    const absNum = Math.abs(num)
    const sign = num < 0 ? '-' : ''
    if (absNum >= 1000000000) {
        return sign + (absNum / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B'
    }
    if (absNum >= 1000000) {
        return sign + (absNum / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M'
    }
    if (absNum >= 1000) {
        return sign + (absNum / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K'
    }
    return sign + absNum.toString()
}

export const MethodBadge = ({ method }: { method: string }) => {
    const methodLower = method?.toLowerCase()
    const className =
        methodLower === 'cna'
            ? 'method-badge method-badge-green'
            : methodLower === 'ptm'
                ? 'method-badge method-badge-purple'
                : 'method-badge method-badge-gray'

    return <span className={className}>{method}</span>
}

export const RateBadge = ({ rate }: { rate: number }) => {
    let className = 'rate-badge rate-badge-gray'
    if (rate >= 90) className = 'rate-badge rate-badge-green'
    else if (rate >= 75) className = 'rate-badge rate-badge-blue'
    else if (rate >= 60) className = 'rate-badge rate-badge-yellow'
    else if (rate >= 40) className = 'rate-badge rate-badge-orange'
    else if (rate >= 20) className = 'rate-badge rate-badge-red'

    return <span className={className}>{rate.toFixed(2)}%</span>
}

export const StatusBadge = ({ status }: { status: string }) => {
    const statusLower = status?.toLowerCase()
    const className =
        statusLower === 'ready'
            ? 'status-badge status-badge-green'
            : statusLower === 'processing'
                ? 'status-badge status-badge-orange'
                : statusLower === 'failed'
                    ? 'status-badge status-badge-red'
                    : 'status-badge status-badge-gray'

    return <span className={className}>{status}</span>
}

type DocumentListingProps = {
    title: string | React.ReactNode
    columns: ColumnConfig[]
    data: any[]
    isLoading?: boolean
    onMenuAction?: (action: string, item: any) => void
    getMenuOptions?: (item: any) => any[]
    emptyMessage?: string
    keyExtractor?: (item: any, index: number) => string | number
    enableInfinite?: boolean
    hasMore?: boolean
    isFetchingMore?: boolean
    onLoadMore?: () => void
    createNew?: {
        buttonTitle: string
        onCreate: () => void
    }
    headerActions?: React.ReactNode
}

const DocumentListing = ({
    title,
    columns = [],
    data = [],
    isLoading = false,
    onMenuAction: _onMenuAction,
    getMenuOptions,
    emptyMessage = 'No data available',
    keyExtractor: _keyExtractor = (item, index) => item?._id ?? item?.id ?? index,
    enableInfinite,
    hasMore,
    isFetchingMore,
    onLoadMore,
    createNew,
    headerActions
}: DocumentListingProps) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState(new Set<string>());

    const wrappedGetMenuOptions = useCallback((item: any) => {
        if (!getMenuOptions) return [];
        const options = getMenuOptions(item);

        return options.map((opt: any) => {
            let label, Icon, onClick, destructive;
            let isArray = false;

            if (Array.isArray(opt)) {
                [label, Icon, onClick] = opt;
                isArray = true;
            } else {
                ({ label, icon: Icon, onClick, destructive } = opt);
                isArray = false;
            }

            // Check for delete intent via label or destructive flag + standard naming
            if (label === 'Delete' || label === 'Remove' || (destructive && /delete|remove/i.test(String(label)))) {
                const originalOnClick = onClick;
                const wrappedOnClick = async (e: any) => {
                    // Get ID using keyExtractor
                    // We pass index 0 but it might rely on index. Hopefully _id is present.
                    const id = String(_keyExtractor(item, 0));

                    // Optimistic hide
                    setOptimisticallyDeletedIds(prev => {
                        const next = new Set(prev);
                        next.add(id);
                        return next;
                    });

                    try {
                        await originalOnClick(e);
                    } catch (err) {
                        // Revert on failure
                        setOptimisticallyDeletedIds(prev => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                        });
                        console.error('Optimistic delete failed, reverting UI', err);
                        // Re-throw so original handler can show error toast
                        throw err;
                    }
                };

                if (isArray) return [label, Icon, wrappedOnClick];
                return { ...opt, onClick: wrappedOnClick };
            }

            return opt;
        });
    }, [getMenuOptions, _keyExtractor]);

    const visibleData = useMemo(() => {
        return data.filter((item, index) => !optimisticallyDeletedIds.has(String(_keyExtractor(item, index))));
    }, [data, optimisticallyDeletedIds, _keyExtractor]);

    const sortedData = useMemo(() => {
        return sortDataWorker(visibleData, sortConfig);
    }, [visibleData, sortConfig]);

    const handleSort = useCallback((col: ColumnConfig) => {
        if (!col.sortable) return
        setSortConfig((prev) => {
            if (prev && prev.key === col.key) {
                return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key: col.key, direction: 'asc' }
        })
    }, [])

    const getSortIndicator = useCallback((col: ColumnConfig) => {
        if (!col.sortable) return null
        if (!sortConfig || sortConfig.key !== col.key) return <span className='sort-indicator'>⇅</span>
        return sortConfig.direction === 'asc' ? (
            <span className='sort-indicator'>↑</span>
        ) : (
            <span className='sort-indicator'>↓</span>
        )
    }, [sortConfig])

    const bodyRef = useRef<HTMLDivElement | null>(null)

    return (
        <Container className='d-flex column h-max document-listing-container color-primary'>
            <Container className='d-flex column gap-3'>
                <Container className='d-flex column gap-1-5 document-listing-header-top-container'>
                    <Container className='d-flex content-between items-center'>
                        <Container className='d-flex gap-1-5 items-center'>
                            {isLoading && !data.length ? (
                                <Skeleton variant='text' width={220} height={32} />
                            ) : (
                                typeof title === 'string' ? (
                                    <Title className='font-size-6 font-weight-5 sm:font-size-4'>{title}</Title>
                                ) : (
                                    title
                                )
                            )}
                            <i>
                                <RxDotsHorizontal />
                            </i>
                        </Container>
                        <Container className='d-flex gap-2 items-center'>
                            {headerActions}
                            {createNew && (
                                <Button
                                    variant='solid'
                                    intent='brand'
                                    onClick={createNew.onCreate}
                                    leftIcon={<Plus size={18} />}
                                >
                                    {createNew.buttonTitle}
                                </Button>
                            )}
                        </Container>
                    </Container>
                </Container>

                <Container>
                    <Container className='d-flex w-max gap-1 document-listing-header-tabs-container'>
                        <Container className='d-flex items-center gap-1 color-secondary document-listing-header-tab-container'>
                            <Container className='d-flex flex-center font-size-4'>
                                <DynamicIcon iconName='RiListUnordered' />
                            </Container>
                            <Paragraph>List</Paragraph>
                        </Container>
                    </Container>
                    <Container className='document-listing-header-filters-container' />
                </Container>
            </Container>

            <Container className='document-listing-body-container overflow-auto flex-1' ref={bodyRef as any}>
                <DocumentListingTable
                    columns={columns}
                    data={sortedData}
                    onCellClick={handleSort}
                    getCellTitle={(col: any) => <>{col.title} {getSortIndicator(col)}</>}
                    isLoading={isLoading}
                    getMenuOptions={wrappedGetMenuOptions}
                    emptyMessage={emptyMessage}
                    enableInfinite={enableInfinite}
                    hasMore={hasMore}
                    isFetchingMore={isFetchingMore}
                    onLoadMore={onLoadMore}
                    keyExtractor={_keyExtractor}
                    scrollContainerRef={bodyRef as any}
                />
            </Container>
        </Container>
    )
}

export default DocumentListing

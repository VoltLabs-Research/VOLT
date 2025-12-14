import React, { useEffect, useRef, useState, useCallback } from 'react'
import { RxDotsHorizontal } from 'react-icons/rx'
import { RiListUnordered } from 'react-icons/ri'
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable'
import { Skeleton } from '@mui/material'
import useWorker from '@/hooks/core/use-worker'
import { WorkerStatus } from '@/utilities/worker-utils'
import './DocumentListing.css'

const sortDataWorker = (
    data: any[],
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null
): any[] => {
    // Helper functions inlined for worker context
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
}

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
    title: string
    breadcrumbs?: (string | React.ReactNode)[]
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
}

const DocumentListing = ({
    title,
    breadcrumbs = ['Dashboard'],
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
    onLoadMore
}: DocumentListingProps) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const [sortedData, setSortedData] = useState<any[]>(data)

    // useWorker for sorting in background thread
    const [sortWorker, { status: sortStatus }] = useWorker(sortDataWorker)

    // Sort data using worker when data or sortConfig changes
    useEffect(() => {
        if (!sortConfig) {
            setSortedData(data)
            return
        }

        sortWorker(data, sortConfig)
            .then(result => {
                setSortedData(result)
            })
            .catch(() => {
                // Fallback to unsorted if worker fails
                setSortedData(data)
            })
    }, [data, sortConfig, sortWorker])

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
    const isSorting = sortStatus === WorkerStatus.RUNNING

    return (
        <div className='document-listing-container'>
            <div className='document-listing-header-container'>
                <div className='document-listing-header-top-container'>
                    <div className='breadcrumbs-container'>
                        {breadcrumbs.map((name, index) => (
                            <div className='breadcrumb-item-container' key={index}>
                                {typeof name === 'string' ? (
                                    <p className='breadcrumb-item-name'>{name}</p>
                                ) : (
                                    name
                                )}
                            </div>
                        ))}
                    </div>
                    <div className='document-listing-header-title-container'>
                        {isLoading && !data.length ? (
                            <Skeleton variant='text' width={220} height={32} />
                        ) : (
                            <h3 className='document-listing-header-title'>{title}</h3>
                        )}
                        <i className='document-listing-header-icon-container'>
                            <RxDotsHorizontal />
                        </i>
                    </div>
                </div>
                <div className='document-listing-header-bottom-container'>
                    <div className='document-listing-header-tabs-container'>
                        <div className='document-listing-header-tab-container'>
                            <i className='document-listing-header-tab-icon-container'>
                                <RiListUnordered />
                            </i>
                            <p className='document-listing-header-tab-name'>List</p>
                        </div>
                    </div>
                    <div className='document-listing-header-filters-container' />
                </div>
            </div>
            <div className='document-listing-body-container' ref={bodyRef}>
                <DocumentListingTable
                    columns={columns}
                    data={sortedData}
                    onCellClick={handleSort}
                    getCellTitle={(col: any) => <>{col.title} {getSortIndicator(col)}</>}
                    isLoading={isLoading || isSorting}
                    getMenuOptions={getMenuOptions}
                    emptyMessage={emptyMessage}
                    enableInfinite={enableInfinite}
                    hasMore={hasMore}
                    isFetchingMore={isFetchingMore}
                    onLoadMore={onLoadMore}
                    keyExtractor={_keyExtractor}
                    scrollContainerRef={bodyRef}
                />
            </div>
        </div>
    )
}

export default DocumentListing

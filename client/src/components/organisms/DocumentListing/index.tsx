import React, { useEffect, useState } from 'react'
import { RxDotsHorizontal } from 'react-icons/rx'
import { RiListUnordered } from 'react-icons/ri'
import { Skeleton } from '@mui/material'
import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer'
import './DocumentListing.css'

export type ColumnConfig = {
    key: string
    title: string
    render?: (value: any, row?: any) => React.ReactNode
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number }
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

const SkeletonRow = ({ columns }: { columns: ColumnConfig[] }) => {
    return (
        <div className='document-listing-table-row-container skeleton-row'>
            {columns.map((col) => (
                <div className='document-listing-cell' key={col.key}>
                    <Skeleton
                        {...(col.skeleton ?? { variant: 'text', width: 100 })}
                        animation='wave'
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.06)',
                            borderRadius: col.skeleton?.variant === 'rounded' ? '12px' : '4px'
                        }}
                    />
                </div>
            ))}
        </div>
    )
}

const DocumentListing = ({
    title,
    breadcrumbs = ['Dashboard'],
    columns = [],
    data = [],
    isLoading = false,
    onMenuAction,
    getMenuOptions,
    showSearch = false,
    emptyMessage = 'No data available',
    keyExtractor = (item, index) => item?._id ?? item?.id ?? index
}: {
    title: string
    breadcrumbs?: string[]
    columns: ColumnConfig[]
    data: any[]
    isLoading?: boolean
    onMenuAction?: (action: string, item: any) => void
    getMenuOptions?: (item: any) => any[]
    showSearch?: boolean
    emptyMessage?: string
    keyExtractor?: (item: any, index: number) => string | number
}) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [filteredData, setFilteredData] = useState(data)

    useEffect(() => {
        if (!showSearch || !searchQuery.trim()) {
            setFilteredData(data)
            return
        }
        const query = searchQuery.toLowerCase()
        setFilteredData(
            data.filter((item) =>
                columns.some((col) =>
                    String(item[col.key] ?? '').toLowerCase().includes(query)
                )
            )
        )
    }, [data, searchQuery, showSearch])

    return (
        <div className='document-listing-container'>
            <div className='document-listing-header-container'>
                <div className='document-listing-header-top-container'>
                    <div className='breadcrumbs-container'>
                        {breadcrumbs.map((name, index) => (
                            <div className='breadcrumb-item-container' key={index}>
                                <p className='breadcrumb-item-name'>{name}</p>
                            </div>
                        ))}
                    </div>
                    <div className='document-listing-header-title-container'>
                        <h3 className='document-listing-header-title'>{title}</h3>
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
                    <div className='document-listing-header-filters-container'></div>
                </div>
            </div>
            <div className='document-listing-body-container'>
                <div className='document-listing-table-container'>
                    {columns.length > 0 && (
                        <div className='document-listing-table-header-container'>
                            {columns.map((col) => (
                                <div className='document-listing-cell header-cell' key={col.key}>
                                    <h4 className='document-listing-cell-title'>{col.title}</h4>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className='document-listing-table-body-container'>
                        {isLoading ? (
                            <>
                                {Array.from({ length: 16 }).map((_, index) => (
                                    <SkeletonRow key={`skeleton-${index}`} columns={columns} />
                                ))}
                            </>
                        ) : filteredData.length === 0 ? (
                            <div className='document-listing-empty'>
                                <p>{emptyMessage}</p>
                            </div>
                        ) : (
                            filteredData.map((item, idx) => (
                                <ActionBasedFloatingContainer
                                    key={keyExtractor(item, idx)}
                                    options={getMenuOptions ? getMenuOptions(item) : []}
                                    className='document-listing-table-row-container'
                                    useCursorPosition={true}
                                    deleteMenuStyle={true}
                                >
                                    {columns.map((col) => (
                                        <div
                                            className='document-listing-cell'
                                            key={col.key}
                                            title={String(item?.[col.key] ?? '')}
                                        >
                                            {col.render
                                                ? col.render(item[col.key], item)
                                                : String(item[col.key] ?? '—')}
                                        </div>
                                    ))}
                                </ActionBasedFloatingContainer>
                            ))
                        )}
                    </div>
                    <div className='document-listing-table-footer-container' />
                </div>
            </div>
        </div>
    )
}

export default DocumentListing

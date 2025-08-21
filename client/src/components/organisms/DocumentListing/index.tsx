import { useEffect, useState } from 'react';
import { RxDotsHorizontal } from "react-icons/rx";
import { RiListUnordered } from "react-icons/ri";
import { Skeleton } from '@mui/material';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer';
import './DocumentListing.css';

const getMethodBadgeClass = (method: string) => {
    const methodLower = method.toLowerCase();
    switch(methodLower){
        case 'cna':
            return 'method-badge method-badge-green';
        case 'ptm':
            return 'method-badge method-badge-purple';
        default:
            return 'method-badge method-badge-gray';
    }
};

const getIdentificationRateBadgeClass = (rate: number) => {
    if(rate >= 90) return 'rate-badge rate-badge-green';
    if(rate >= 75) return 'rate-badge rate-badge-blue'; 
    if(rate >= 60) return 'rate-badge rate-badge-yellow'; 
    if(rate >= 40) return 'rate-badge rate-badge-orange'; 
    if(rate >= 20) return 'rate-badge rate-badge-red';  
    return 'rate-badge rate-badge-gray';
};

const formatNumber = (num: number) => {
    if(num === 0) return '0';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if(absNum >= 1000000000){
        return sign + (absNum / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
    }

    if(absNum >= 1000000){
        return sign + (absNum / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }

    if(absNum >= 1000){
        return sign + (absNum / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    }
    
    return sign + absNum.toString();
};

const defaultFormatValue = (key: string, value: any) => {
    if(value === null || value === undefined) return '—';
    switch (key) {
        case 'createdAt':
        case 'updatedAt':
        case 'date':
            return formatTimeAgo(value);
        case 'identificationRate':
            const rate = Number(value);
            return (
                <span className={getIdentificationRateBadgeClass(rate)}>
                    {`${rate.toFixed(2)}%`}
                </span>
            );
        case 'identifiedStructures':
        case 'unidentifiedStructures':
        case 'totalAtoms':
        case 'count':
        case 'size':
            return formatNumber(Number(value));
        case 'trajectory':
            return typeof value === 'object' ? (value.name ?? '—') : String(value);
        case 'analysisMethod':
        case 'method':
            return (
                <span className={getMethodBadgeClass(value)}>
                    {String(value)}
                </span>
            );
        default:
            return String(value);
    }
};

const SkeletonRow = ({ columns }) => {
    const getSkeletonVariant = (columnKey) => {
        switch (columnKey) {
            case 'identificationRate':
                return { variant: "rounded", width: 60, height: 24 };
            case 'analysisMethod':
            case 'method':
                return { variant: "rounded", width: 80, height: 24 };
            case 'identifiedStructures':
            case 'unidentifiedStructures':
            case 'totalAtoms':
            case 'timestep':
                return { variant: "text", width: 70 };
            case 'trajectory':
                return { variant: "text", width: 120 };
            case 'createdAt':
            case 'updatedAt':
            case 'date':
                return { variant: "text", width: 90 };
            default:
                return { variant: "text", width: 100 };
        }
    };

    return (
        <div className="document-listing-table-row-container skeleton-row">
            {columns.map((column) => {
                const skeletonProps = getSkeletonVariant(column.key);
                return (
                    <div className='document-listing-cell' key={column.key}>
                        <Skeleton 
                            {...skeletonProps}
                            animation="wave"
                            sx={{ 
                                bgcolor: 'rgba(0, 0, 0, 0.06)',
                                borderRadius: skeletonProps.variant === 'rounded' ? '12px' : '4px'
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

const DocumentListing = ({ 
    title,
    breadcrumbs = ['Dashboard'],
    columns = [],
    data = [],
    isLoading = false,
    onMenuAction,
    getMenuOptions,
    formatValue = defaultFormatValue,
    showSearch = false,
    emptyMessage = "No data available",
    keyExtractor = (item, index) => item?._id ?? item?.id ?? index
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredData, setFilteredData] = useState(data);

    useEffect(() => {
        if (!showSearch || !searchQuery.trim()) {
            setFilteredData(data);
            return;
        }

    }, [data, columns, showSearch]);

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

                    <div className='document-listing-header-filters-container'>
            
                    </div>
                </div>
            </div>

            <div className='document-listing-body-container'>
                <div className='document-listing-table-container'>
                    {columns.length > 0 && (
                        <div className='document-listing-table-header-container'>
                            {columns.map((column) => (
                                <div className='document-listing-cell header-cell' key={column.key}>
                                    <h4 className='document-listing-cell-title'>{column.title}</h4>
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
                                    options={getMenuOptions(item)}
                                    className="document-listing-table-row-container"
                                    useCursorPosition={true}
                                    deleteMenuStyle={true}
                                >
                                    {columns.map((column) => (
                                        <div
                                            className='document-listing-cell'
                                            key={column.key}
                                            title={String(item?.[column.key] ?? '')}
                                        >
                                            {formatValue(column.key, item?.[column.key])}
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
    );
};

export default DocumentListing;
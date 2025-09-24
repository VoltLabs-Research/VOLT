import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer';
import type { ColumnConfig } from '@/components/organisms/DocumentListing';
import { Skeleton } from '@mui/material';

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
};

const DocumentListingTable = ({
    columns, 
    data,
    onCellClick = (_col: any) => {},
    getCellTitle = (col: any) => col.title,
    isLoading = false,
    getMenuOptions = undefined,
    emptyMessage = 'No documents to show.'
}: any) => {
    return (
        <div className='document-listing-table-container'>
            {columns.length > 0 && (
                <div className='document-listing-table-header-container'>
                    {columns.map((col: any, colIdx: number) => (
                        <div
                            className={`document-listing-cell header-cell ${col.sortable ? 'sortable' : ''}`}
                            key={`header-${col.title}-${colIdx}`} 
                            onClick={() => onCellClick(col)}
                        >
                            <h4 className='document-listing-cell-title'>
                                {getCellTitle(col)}
                            </h4>
                        </div>
                    ))}
                </div>
            )}

            <div className='document-listing-table-body-container'>
                {isLoading ? (
                    Array.from({ length: 16 }).map((_, index) => (
                        <SkeletonRow key={`skeleton-${index}`} columns={columns} />
                    )) 
                ) : data.length === 0 ? (
                    <div className='document-listing-empty'>
                        <p>{emptyMessage}</p>
                    </div>
                ) : (
                    data.map((item: any, idx: number) => (
                        <ActionBasedFloatingContainer
                            key={'item-' + idx}
                            options={getMenuOptions ? getMenuOptions(item) : []}
                            className='document-listing-table-row-container'
                            useCursorPosition={true}
                            deleteMenuStyle={true}
                        >
                            {columns.map((col: any, colIdx: number) => (
                                <div
                                    className='document-listing-cell'
                                    key={`cell-${col.title}-${colIdx}`}
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
    );
};

export default DocumentListingTable;
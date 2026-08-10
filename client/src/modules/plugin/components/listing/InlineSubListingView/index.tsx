import { useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import PluginCompactTable from '@/modules/plugin/components/listing/PluginCompactTable';
import { Button, cn } from '@heroui/react';
import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import { buildCompactSubListingColumns } from '@/modules/plugin/components/listing/sub-listing-columns';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';

export interface InlineSubListingViewProps {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingNames: string[];
    activeName: string;
    onActiveNameChange: (name: string) => void;
    onClose: () => void;
}

const SUB_LISTING_PAGE_SIZE = 50;

const InlineSubListingView = ({
    analysisId,
    exposureId,
    timestep,
    subListingNames,
    activeName,
    onActiveNameChange,
    onClose
}: InlineSubListingViewProps) => {
    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error
    } = useSubListingInfiniteQuery(
        {
            analysisId,
            exposureId,
            timestep,
            subListingName: activeName,
            limit: SUB_LISTING_PAGE_SIZE
        },
        {
            getNextPageParam: (lastPage) => (
                lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
            ),
            enabled: Boolean(analysisId && exposureId && activeName)
        }
    );

    const rows = useMemo(
        () => infiniteData?.pages.flatMap((page) => page.rows) ?? [],
        [infiniteData]
    );

    const columns = useMemo(
        () => buildCompactSubListingColumns(infiniteData?.pages[0]?.columns ?? [], rows),
        [infiniteData, rows]
    );

    const handleLoadMore = useCallback(() => {
        if(hasNextPage && !isFetchingNextPage){
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const errorMessage = useMemo(() => {
        if(!error) return null;
        if(isAccessDeniedError(error)) return 'Access denied';
        return reportError(error, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load sub-listing.'
        }).title;
    }, [error]);

    return (
        <div className='flex h-full min-h-0 flex-col overflow-hidden'>
            <div className='flex shrink-0 flex-row items-center gap-2 border-b border-border px-2 py-1'>
                <Button
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    onPress={onClose}
                    aria-label='Back to listing'
                >
                    <ArrowLeft size={14} aria-hidden='true' />
                </Button>
                <div className='flex min-w-0 flex-1 flex-row flex-nowrap gap-[0.2rem] overflow-x-auto' role='tablist'>
                    {subListingNames.map((name) => {
                        const isActive = name === activeName;
                        return (
                            <button
                                key={name}
                                type='button'
                                role='tab'
                                aria-selected={isActive}
                                className={cn(
                                    'cursor-pointer whitespace-nowrap rounded-[4px] border-0 bg-transparent px-[0.55rem] py-[0.2rem] text-[0.6875rem] font-medium transition-colors duration-[120ms] ease-out hover:bg-surface-hover hover:text-foreground',
                                    isActive ? 'bg-accent/14 text-foreground' : 'text-muted'
                                )}
                                onClick={() => onActiveNameChange(name)}
                            >
                                {formatSnakeCaseToTitle(name)}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
                <PluginCompactTable
                    columns={columns}
                    data={rows}
                    isLoading={isLoading}
                    isFetchingMore={isFetchingNextPage}
                    hasMore={hasNextPage}
                    onLoadMore={handleLoadMore}
                    error={errorMessage}
                />
            </div>
        </div>
    );
};

export default InlineSubListingView;

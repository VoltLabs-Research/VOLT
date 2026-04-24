import { useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable';
import IconButton from '@/shared/presentation/primitives/IconButton';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import { inferColumnType, type InferredColumnType, type InferredCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { renderInferredCell } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import './InlineSubListingView.css';

interface InlineSubListingViewProps {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingNames: string[];
    activeName: string;
    onActiveNameChange: (name: string) => void;
    onClose: () => void;
};

const MIN_WIDTH_BY_KIND: Record<InferredCellKind, number> = {
    empty: 80,
    boolean: 72,
    integer: 96,
    number: 120,
    string: 180,
    date: 180,
    vector: 240,
    numberArray: 180,
    points: 120,
    matrix: 140,
    object: 280,
    mixed: 200
};

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
    const enabled = Boolean(analysisId && exposureId && activeName);

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
            getNextPageParam: (lastPage) => {
                if(lastPage.page < lastPage.totalPages){
                    return lastPage.page + 1;
                }
                return undefined;
            },
            enabled
        }
    );

    const rows = useMemo(() => {
        if(!infiniteData?.pages) return [];
        return infiniteData.pages.flatMap((page) => page.rows ?? []);
    }, [infiniteData]);

    const columns = useMemo<ColumnConfig[]>(() => {
        const firstPage = infiniteData?.pages?.[0];
        if(!firstPage?.columns?.length) return [];

        return firstPage.columns.map((column) => {
            const key = column.label;
            const samples = rows.slice(0, 30).map((row) => (row as Record<string, unknown>)[key]);
            const inferred: InferredColumnType = inferColumnType(samples);

            return {
                key,
                title: formatSnakeCaseToTitle(key),
                width: MIN_WIDTH_BY_KIND[inferred.kind] ?? MIN_WIDTH_BY_KIND.mixed,
                render: (value: unknown) => renderInferredCell(value, inferred)
            };
        });
    }, [infiniteData, rows]);

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
        <div className='plugin-inline-sub-listing'>
            <div className='plugin-inline-sub-listing__header'>
                <IconButton
                    size='sm'
                    variant='ghost'
                    onClick={onClose}
                    aria-label='Back to listing'
                >
                    <ArrowLeft size={14} />
                </IconButton>
                <div className='plugin-inline-sub-listing__tabs' role='tablist'>
                    {subListingNames.map((name) => {
                        const isActive = name === activeName;
                        return (
                            <button
                                key={name}
                                type='button'
                                role='tab'
                                aria-selected={isActive}
                                className={`plugin-inline-sub-listing__tab${isActive ? ' plugin-inline-sub-listing__tab--active' : ''}`}
                                onClick={() => onActiveNameChange(name)}
                            >
                                {formatSnakeCaseToTitle(name)}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className='plugin-inline-sub-listing__body'>
                <PluginCompactTable
                    columns={columns}
                    data={rows as Record<string, unknown>[]}
                    isLoading={isLoading}
                    isFetchingMore={isFetchingNextPage}
                    hasMore={hasNextPage ?? false}
                    onLoadMore={handleLoadMore}
                    error={errorMessage}
                />
            </div>
        </div>
    );
};

export default InlineSubListingView;

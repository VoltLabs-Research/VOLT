import { useCallback, useMemo, useState } from 'react';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import PluginCompactTable from '@/modules/plugin/components/listing/PluginCompactTable';
import InlineSubListingView, { type InlineSubListingViewProps } from '@/modules/plugin/components/listing/InlineSubListingView';
import { LISTING_QUERY_KEYS, usePluginListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import usePluginListing from '@/modules/plugin/hooks/listing/use-plugin-listing';
import useDeletePluginListingAnalyses from '@/modules/plugin/hooks/listing/use-delete-plugin-listing-analyses';
import { normalizeListingColumns } from '@/modules/plugin/utils/listing/normalize-listing-columns';
import { buildListingRowMenuOptions } from '@/modules/plugin/utils/listing/listing-row-menu-options';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ListingRow } from '@volt/contracts/modules/plugin/listing';
import { TABLE_RECOVERY_STATE_CLASS } from '@/modules/plugin/components/listing/PluginCompactTable/table-styles';

export interface PluginExposureTableProps {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    compact?: boolean;
    inlineSubListings?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
    onRowClick?: (row: ListingRow) => void;
    isRowSelected?: (row: ListingRow) => boolean;
}

type InlineSubListingState = Omit<InlineSubListingViewProps, 'onActiveNameChange' | 'onClose'>;

const COMPACT_PAGE_SIZE = 20;

const CompactPluginExposureTable = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn,
    inlineSubListings,
    onRowClick,
    isRowSelected
}: PluginExposureTableProps) => {
    const navigate = useNavigate();
    const deleteRows = useDeletePluginListingAnalyses();
    const [inlineState, setInlineState] = useState<InlineSubListingState | null>(null);

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error
    } = usePluginListingInfiniteQuery(
        {
            pluginId,
            exposureName,
            exposureId,
            trajectoryId,
            analysisId,
            limit: COMPACT_PAGE_SIZE
        },
        {
            getNextPageParam: (lastPage) => (
                lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined
            ),
            enabled: Boolean(pluginId && (exposureName || exposureId) && (trajectoryId || teamId))
        }
    );

    // Row and column identities feed the virtualized table's own memoized
    // column-type inference, so they must stay stable across renders.
    const rows = useMemo(
        () => infiniteData?.pages.flatMap((page) => page.data) ?? [],
        [infiniteData]
    );

    const columns = useMemo(() => normalizeListingColumns(
        infiniteData?.pages.find((page) => page._meta?.columns?.length)?._meta?.columns,
        showTrajectoryColumn ?? !trajectoryId
    ), [infiniteData, showTrajectoryColumn, trajectoryId]);

    const subListingNames = useMemo(
        () => infiniteData?.pages.find((page) => page._meta?.subListingNames?.length)?._meta?.subListingNames ?? [],
        [infiniteData]
    );

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const selectedRowId = useMemo(() => {
        if (!isRowSelected) return null;
        const selectedRow = rows.find((row) => isRowSelected(row));
        return selectedRow ? String(selectedRow._id) : null;
    }, [rows, isRowSelected]);

    const getMenuOptions = useCallback((row: Record<string, unknown>): MenuOption[] => {
        const item = row as ListingRow;

        return buildListingRowMenuOptions({
            row: item,
            subListingNames,
            navigate,
            onDelete: () => deleteRows([item]),
            onViewSubListing: inlineSubListings
                ? ({ subListingName, ...target }) => setInlineState({
                    ...target,
                    subListingNames,
                    activeName: subListingName
                })
                : undefined
        });
    }, [navigate, subListingNames, deleteRows, inlineSubListings]);

    if (inlineState) {
        return (
            <InlineSubListingView
                {...inlineState}
                onActiveNameChange={(activeName) => setInlineState((prev) => (prev ? {
                    ...prev,
                    activeName
                } : prev))}
                onClose={() => setInlineState(null)}
            />
        );
    }

    if (error && isAccessDeniedError(error)) {
        return (
            <RecoveryState
                title='Access denied'
                description='You do not have permission to view this data.'
                tone={RecoveryStateTone.AccessDenied}
                className={TABLE_RECOVERY_STATE_CLASS}
            />
        );
    }

    return (
        <PluginCompactTable
            key={`${pluginId}:${analysisId ?? 'default'}:${trajectoryId ?? 'all'}:${exposureId ?? exposureName ?? 'unknown'}`}
            columns={columns}
            data={rows}
            hasMore={hasNextPage}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            error={error && reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to load listing.'
            }).title}
            getMenuOptions={getMenuOptions}
            onRowClick={onRowClick && ((row) => onRowClick(row as ListingRow))}
            selectedRowId={selectedRowId}
        />
    );
};

const FullPluginExposureTable = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn,
    headerActions
}: PluginExposureTableProps) => {
    const listingHook = usePluginListing({
        pluginId,
        exposureName,
        exposureId,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn
    });

    return (
        <DocumentListing
            title={listingHook.resolvedExposureName || exposureId || 'Listing'}
            queryKey={LISTING_QUERY_KEYS.listingDetail({
                pluginId,
                exposureName,
                exposureId,
                trajectoryId,
                analysisId,
                page: 1,
                limit: 20
            })}
            fetchData={listingHook.fetchData}
            context={listingHook.context}
            enabled={listingHook.isEnabled}
            columns={listingHook.columns}
            getMenuOptions={listingHook.getMenuOptions}
            headerActions={headerActions}
        />
    );
};

const PluginExposureTable = (props: PluginExposureTableProps) => {
    if (props.compact) {
        return <CompactPluginExposureTable {...props} />;
    }

    return <FullPluginExposureTable {...props} />;
};

export default PluginExposureTable;

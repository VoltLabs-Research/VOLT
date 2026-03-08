import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import DocumentListing, { type ColumnConfig as ListingColumnConfig } from '@/shared/presentation/components/DocumentListing';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/components/listing/organisms/PluginCompactTable';
import SubListingModal from '@/modules/plugin/components/listing/organisms/SubListingModal';
import { LISTING_QUERY_KEYS, usePluginListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import usePluginListing from '@/modules/plugin/hooks/listing/use-plugin-listing';
import usePluginSubListing from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';
import useDeletePluginListingAnalyses from '@/modules/plugin/hooks/listing/use-delete-plugin-listing-analyses';
import ApiError from '@/shared/errors/ApiError';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { openModal } from '@/shared/presentation/components/Modal';
import '@/modules/plugin/components/listing/organisms/PluginExposureTable/PluginExposureTable.css';

export interface PluginExposureTableProps {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
    onDataReady?: (columns: ColumnConfig[], data: Record<string, unknown>[]) => void;
}

const normalizeListingColumns = (columns: ListingColumnConfig[] | undefined): ListingColumnConfig[] => {
    if (!columns?.length) return [];

    return columns.map((column: ListingColumnConfig) => {
        const key = String(column?.key || column?.label || '');
        const title = column?.title || (column?.label ? formatSnakeCaseToTitle(column.label) : key);

        return {
            key,
            title,
            sortable: Boolean(column?.sortable)
        };
    });
};

const CompactPluginExposureTable = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    onDataReady
}: PluginExposureTableProps) => {
    const pageSize = 20;
    const [rbacDenied, setRbacDenied] = useState(false);
    const [rbacMessage, setRbacMessage] = useState<string>();

    const compactEnabled = Boolean(pluginId && (exposureName || exposureId) && (trajectoryId || teamId));

    const {
        data: infiniteData,
        isLoading: compactLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error: compactError
    } = usePluginListingInfiniteQuery(
        {
            pluginId,
            exposureName,
            exposureId,
            trajectoryId,
            analysisId,
            limit: pageSize
        },
        {
            getNextPageParam: (lastPage) => {
                if (lastPage.pagination?.hasMore) {
                    return (lastPage.pagination.page ?? 1) + 1;
                }
                return undefined;
            },
            enabled: compactEnabled
        }
    );

    // Handle RBAC errors from compact query
    useEffect(() => {
        if (!compactError) {
            setRbacDenied(false);
            setRbacMessage(undefined);
            return;
        }

        if (ApiError.isRBACError(compactError)) {
            setRbacDenied(true);
            if (compactError instanceof ApiError) setRbacMessage(compactError.getFriendlyMessage());
            return;
        }

        setRbacDenied(false);
        setRbacMessage(undefined);
    }, [compactError]);

    const compactRows = useMemo(() => {
        if (!infiniteData?.pages) return [];
        return infiniteData.pages.flatMap((page) => page.data ?? []);
    }, [infiniteData]);

    const compactColumns = useMemo<ListingColumnConfig[]>(() => {
        if (!infiniteData?.pages?.length) return [];

        for (const page of infiniteData.pages) {
            const cols = page._meta?.columns;
            if (!cols?.length) continue;

            return normalizeListingColumns(cols);
        }

        return [];
    }, [infiniteData]);

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        if (!onDataReady) return;
        onDataReady(compactColumns, compactRows);
    }, [compactColumns, compactRows, onDataReady]);

    if (rbacDenied) {
        return <AccessDenied description={rbacMessage} showBack={false} />;
    }

    const compactErrorMessage = compactError && !ApiError.isRBACError(compactError)
        ? (compactError instanceof Error ? compactError.message : 'Failed to load listing.')
        : null;

    return (
        <>
            <PluginCompactTable
                key={`${pluginId}:${analysisId ?? 'default'}:${trajectoryId ?? 'all'}:${exposureId ?? exposureName ?? 'unknown'}`}
                columns={compactColumns}
                data={compactRows}
                hasMore={hasNextPage ?? false}
                isLoading={compactLoading}
                isFetchingMore={isFetchingNextPage}
                onLoadMore={handleLoadMore}
                error={compactErrorMessage}
                onDataReady={onDataReady}
            />
            <SubListingModal subListingParams={null} />
        </>
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
    const {
        subListingParams,
        setSubListingParams,
        resetSubListing
    } = usePluginSubListing();
    const deleteRows = useDeletePluginListingAnalyses();

    const openSubListing = useCallback((params: { analysisId: string; exposureId: string; timestep: number; subListingName: string }) => {
        setSubListingParams(params);
        openModal('sub-listing-modal');
    }, [setSubListingParams]);

    const listingHook = usePluginListing({
        pluginId,
        exposureName,
        exposureId,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn,
        openSubListing,
        onDeleteRows: deleteRows
    });

    const displayExposureName = listingHook.resolvedExposureName ?? exposureName ?? exposureId;

    return (
        <>
            <DocumentListing
                title={displayExposureName || 'Listing'}
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
                exportConfig={{
                    onExport: ({ format }) => listingHook.exportData(format),
                    getFilename: (format) => `${pluginId}_${displayExposureName || 'listing'}.${format}`
                }}
                headerActions={headerActions}
            />
            <SubListingModal
                subListingParams={subListingParams}
                onClose={resetSubListing}
            />
        </>
    );
};

const PluginExposureTable = (props: PluginExposureTableProps) => {
    if (props.compact) {
        return <CompactPluginExposureTable {...props} />;
    }

    return <FullPluginExposureTable {...props} />;
};

export default PluginExposureTable;

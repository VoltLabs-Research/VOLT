import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiDeleteBin6Line, RiEyeLine, RiTableLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig as ListingColumnConfig } from '@/shared/presentation/components/DocumentListing';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable';
import InlineSubListingView from '@/modules/plugin/components/listing/InlineSubListingView';
import { LISTING_QUERY_KEYS, usePluginListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import usePluginListing from '@/modules/plugin/hooks/listing/use-plugin-listing';
import useDeletePluginListingAnalyses from '@/modules/plugin/hooks/listing/use-delete-plugin-listing-analyses';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { buildAtomsViewerPath } from '@/modules/trajectory/utilities/build-atoms-viewer-path';
import { buildSubListingsPath } from '@/modules/plugin/utilities/listing/build-sub-listings-path';
import type { ReactNode } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';
import '@/modules/plugin/components/listing/PluginExposureTable/PluginExposureTable.css';
import { useNavigate } from 'react-router-dom';
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
    onDataReady?: (columns: ColumnConfig[], data: Record<string, unknown>[]) => void;
}

interface InlineSubListingState {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingNames: string[];
    activeName: string;
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
    showTrajectoryColumn,
    inlineSubListings,
    onDataReady
}: PluginExposureTableProps) => {
    const navigate = useNavigate();
    const pageSize = 20;
    const deleteRows = useDeletePluginListingAnalyses();
    const [inlineState, setInlineState] = useState<InlineSubListingState | null>(null);

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

    const compactRows = useMemo(() => {
        if (!infiniteData?.pages) return [];
        return infiniteData.pages.flatMap((page) => page.data ?? []);
    }, [infiniteData]);

    const compactColumns = useMemo<ListingColumnConfig[]>(() => {
        if (!infiniteData?.pages?.length) return [];

        const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;

        for (const page of infiniteData.pages) {
            const cols = page._meta?.columns;
            if (!cols?.length) continue;

            const normalizedColumns = normalizeListingColumns(cols);
            if (shouldShowTrajectory) {
                return normalizedColumns;
            }

            return normalizedColumns.filter((column) => String(column.key) !== 'trajectoryName');
        }

        return [];
    }, [infiniteData, showTrajectoryColumn, trajectoryId]);

    const subListingNames = useMemo<string[]>(() => {
        if (!infiniteData?.pages?.length) return [];
        for (const page of infiniteData.pages) {
            const names = page._meta?.subListingNames;
            if (names?.length) return names;
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

    const getMenuOptions = useCallback((row: Record<string, unknown>): MenuOption[] => {
        const item = row as Record<string, unknown> & { _id?: string; trajectoryId?: string; analysisId?: string; exposureId?: string; timestep?: number };
        const options: MenuOption[] = [];

        if (item.trajectoryId && item.analysisId && item.timestep !== undefined) {
            options.push({
                label: 'Inspect Atoms',
                icon: RiEyeLine,
                onClick: () => navigate(buildAtomsViewerPath({
                    trajectoryId: item.trajectoryId!,
                    analysisId: item.analysisId,
                    timestep: item.timestep!
                }))
            });

            for (const name of subListingNames) {
                options.push({
                    label: `View ${formatSnakeCaseToTitle(name)}`,
                    icon: RiTableLine,
                    onClick: () => {
                        if (!item.trajectoryId || !item.analysisId || !item.exposureId || item.timestep === undefined) return;

                        if (inlineSubListings) {
                            setInlineState({
                                analysisId: item.analysisId,
                                exposureId: item.exposureId,
                                timestep: item.timestep,
                                subListingNames,
                                activeName: name
                            });
                            return;
                        }

                        navigate(buildSubListingsPath({
                            trajectoryId: item.trajectoryId,
                            analysisId: item.analysisId,
                            exposureId: item.exposureId,
                            timestep: item.timestep,
                            subListingNames,
                            activeSubListingName: name
                        }));
                    }
                });
            }
        }

        if (item.analysisId) {
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => deleteRows([row as ListingRow]),
                destructive: true
            });
        }

        return options;
    }, [navigate, subListingNames, deleteRows, inlineSubListings]);

    if (inlineState) {
        return (
            <InlineSubListingView
                analysisId={inlineState.analysisId}
                exposureId={inlineState.exposureId}
                timestep={inlineState.timestep}
                subListingNames={inlineState.subListingNames}
                activeName={inlineState.activeName}
                onActiveNameChange={(name) => setInlineState((prev) => (prev ? { ...prev, activeName: name } : prev))}
                onClose={() => setInlineState(null)}
            />
        );
    }

    if (compactError && isAccessDeniedError(compactError)) {
        return (
            <RecoveryState
                title='Access denied'
                description='You do not have permission to view this data.'
                tone={RecoveryStateTone.AccessDenied}
                className='plugin-exposure-recovery-state'
            />
        );
    }

    const compactErrorMessage = compactError && !isAccessDeniedError(compactError)
        ? reportError(compactError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load listing.'
        }).title
        : null;

    return (
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
            getMenuOptions={getMenuOptions}
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
    const deleteRows = useDeletePluginListingAnalyses();

    const listingHook = usePluginListing({
        pluginId,
        exposureName,
        exposureId,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn,
        onDeleteRows: deleteRows
    });

    const displayExposureName = listingHook.resolvedExposureName ?? exposureName ?? exposureId;

    return (
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

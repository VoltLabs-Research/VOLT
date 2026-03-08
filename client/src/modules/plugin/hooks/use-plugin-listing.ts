import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEyeLine, RiTableLine } from 'react-icons/ri';
import {
    fetchPluginListing,
    useExportListingMutation,
    usePluginListingQuery
} from './listing/queries';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ExportType } from '@/shared/domain/export/types';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';
import type { ListingRow } from '../api/entities/listing-row';
import formatSnakeCaseToTitle from '../utilities/format-snake-case';
import type { PluginSubListingParams } from './use-plugin-sub-listing';

export const SUB_LISTING_MODAL_ID = 'sub-listing-modal';

interface UsePluginListingParams {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    showTrajectoryColumn?: boolean;
    openSubListing: (params: PluginSubListingParams) => void;
}

interface PluginListingContext {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
};

interface UsePluginListingReturn {
    columns: ColumnConfig[];
    context: PluginListingContext;
    isEnabled: boolean;
    resolvedExposureName?: string;
    subListingNames: string[];
    fetchData: (params: { page: number; limit: number } & PluginListingContext) => Promise<PaginatedResponse<ListingRow>>;
    exportData: (format: ExportType) => Promise<Blob>;
    openSubListing: (params: PluginSubListingParams) => void;
    getMenuOptions: (item: ListingRow, selectedItems: ListingRow[]) => MenuOption[];
};

const TRAJECTORY_COLUMN: ColumnConfig = {
    key: 'trajectoryName',
    title: 'Trajectory',
    sortable: false
};

const usePluginListing = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn,
    openSubListing
}: UsePluginListingParams): UsePluginListingReturn => {
    const navigate = useNavigate();
    const exportListingMutation = useExportListingMutation();
    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();

    const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;

    const context: PluginListingContext = useMemo(() => ({
        pluginId,
        exposureName,
        exposureId,
        trajectoryId,
        analysisId,
        teamId
    }), [pluginId, exposureName, exposureId, trajectoryId, analysisId, teamId]);

    const isEnabled = !!(pluginId && (exposureName || exposureId) && (trajectoryId || teamId));

    const listingMetaQuery = usePluginListingQuery(
        {
            pluginId,
            exposureName,
            exposureId,
            trajectoryId,
            analysisId,
            page: 1,
            limit: 20
        },
        {
            enabled: isEnabled
        }
    );

    const dynamicColumns = useMemo<ColumnConfig[]>(() => {
        const cols = listingMetaQuery.data?._meta?.columns;
        if (!cols?.length) {
            return [];
        }

        return cols.map((column: ColumnConfig) => {
            const key = String(column?.key || column?.label || '');
            const title = column?.title || (column?.label ? formatSnakeCaseToTitle(column.label) : key);
            return {
                key,
                title,
                sortable: Boolean(column?.sortable)
            };
        });
    }, [listingMetaQuery.data?._meta?.columns]);

    const columns = useMemo(() => {
        if (!shouldShowTrajectory) return dynamicColumns;
        return [TRAJECTORY_COLUMN, ...dynamicColumns];
    }, [dynamicColumns, shouldShowTrajectory]);

    const resolvedExposureName = listingMetaQuery.data?._meta?.exposureName ?? exposureName;
    const subListingNames = listingMetaQuery.data?._meta?.subListingNames ?? [];

    const fetchData = useCallback(async (
        params: { page: number; limit: number } & PluginListingContext
    ): Promise<PaginatedResponse<ListingRow>> => {
        const response = await fetchPluginListing({
            pluginId: params.pluginId,
            exposureName: params.exposureName,
            exposureId: params.exposureId,
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            page: params.page,
            limit: params.limit
        });

        return {
            status: 'success',
            data: response.data,
            pagination: response.pagination,
            _meta: response._meta
        };
    }, []);

    const exportData = useCallback(async (format: ExportType): Promise<Blob> => {
        return exportListingMutation.mutateAsync({
            pluginId,
            exposureName,
            exposureId,
            trajectoryId,
            analysisId,
            format
        });
    }, [exportListingMutation, pluginId, exposureName, exposureId, trajectoryId, analysisId]);

    const handleDelete = useCallback(async (rows: ListingRow[]) => {
        const analysisIds = rows
            .map((row) => row.analysisId)
            .filter((analysisId): analysisId is string => Boolean(analysisId));

        if (!analysisIds.length) {
            sileo.error({ title: 'No analysis ID found for deletion' });
            return;
        }

        const isConfirmed = confirm(
            analysisIds.length === 1
                ? 'Delete this analysis? This cannot be undone.'
                : `Delete ${analysisIds.length} analyses? This cannot be undone.`
        );
        if (!isConfirmed) return;

        try {
            await Promise.all(analysisIds.map((analysisId) =>
                showPromise(deleteAnalysisMutation.mutateAsync(analysisId), {
                    loading: { title: 'Deleting analysis...' },
                    success: { title: 'Analysis deleted' },
                    error: { title: 'Failed to delete analysis' }
                })
            ));
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
        }
    }, [deleteAnalysisMutation]);

    const handleViewSubListing = useCallback((item: ListingRow, subListingName: string) => {
        if (!item.analysisId || !item.exposureId || item.timestep === undefined) return;

        openSubListing({
            analysisId: item.analysisId,
            exposureId: item.exposureId,
            timestep: item.timestep,
            subListingName
        });
    }, [openSubListing]);

    const getMenuOptions = useCallback((item: ListingRow, selectedItems: ListingRow[]): MenuOption[] => {
        const targetRows = selectedItems.includes(item) ? selectedItems : [item];
        const isMultipleSelection = targetRows.length > 1;
        const options: MenuOption[] = [];

        if (!isMultipleSelection && item.trajectoryId && item.analysisId && item.timestep !== undefined) {
            options.push({
                label: 'Inspect Atoms',
                icon: RiEyeLine,
                onClick: () => navigate(
                    `/dashboard/trajectory/${item.trajectoryId}/analysis/${item.analysisId}/atoms?timestep=${item.timestep}`
                )
            });

            for (const name of subListingNames) {
                options.push({
                    label: `View ${formatSnakeCaseToTitle(name)}`,
                    icon: RiTableLine,
                    onClick: () => handleViewSubListing(item, name)
                });
            }
        }

        if (item.analysisId) {
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDelete(targetRows),
                destructive: true
            });
        }

        return options;
    }, [handleDelete, handleViewSubListing, navigate, subListingNames]);

    return {
        columns,
        context,
        isEnabled,
        resolvedExposureName,
        subListingNames,
        fetchData,
        exportData,
        openSubListing,
        getMenuOptions
    };
};

export type { PluginListingContext };
export default usePluginListing;

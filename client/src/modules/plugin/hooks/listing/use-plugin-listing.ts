import { useCallback, useMemo } from 'react';
import { RiDeleteBin6Line, RiEyeLine, RiTableLine } from 'react-icons/ri';
import {
    fetchPluginListing,
    usePluginListingQuery
} from './queries';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import type { PluginSubListingParams } from './use-plugin-sub-listing';
import { useNavigate } from 'react-router-dom';
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
    onDeleteRows?: (rows: ListingRow[]) => Promise<void> | void;
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
    openSubListing: (params: PluginSubListingParams) => void;
    getMenuOptions: (item: ListingRow, selectedItems: ListingRow[]) => MenuOption[];
};

const usePluginListing = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn,
    openSubListing,
    onDeleteRows
}: UsePluginListingParams): UsePluginListingReturn => {
    const navigate = useNavigate();

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
        if (shouldShowTrajectory) {
            return dynamicColumns;
        }

        return dynamicColumns.filter((column) => String(column.key) !== 'trajectoryName');
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

    const handleDelete = useCallback(async (rows: ListingRow[]) => {
        await onDeleteRows?.(rows);
    }, [onDeleteRows]);

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

        if (item.analysisId && onDeleteRows) {
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDelete(targetRows),
                destructive: true
            });
        }

        return options;
    }, [handleDelete, handleViewSubListing, navigate, onDeleteRows, subListingNames]);

    return {
        columns,
        context,
        isEnabled,
        resolvedExposureName,
        subListingNames,
        fetchData,
        openSubListing,
        getMenuOptions
    };
};

export type { PluginListingContext };
export default usePluginListing;

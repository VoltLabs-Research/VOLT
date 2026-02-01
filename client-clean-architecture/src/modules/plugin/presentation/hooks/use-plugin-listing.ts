import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import usePluginListingStore from '../stores/use-plugin-listing-store';
import usePluginUseCases from './use-plugin-use-cases';
import useDeleteAnalysis from '@/modules/analysis/presentation/hooks/use-delete-analysis';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ListingRow } from '../../domain/entities';

interface UsePluginListingParams {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    showTrajectoryColumn?: boolean;
};

interface PluginListingContext {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    teamId?: string;
};

interface UsePluginListingReturn {
    columns: ColumnConfig[];
    context: PluginListingContext;
    isEnabled: boolean;
    fetchData: (params: { page: number; limit: number } & PluginListingContext) => Promise<PaginatedResponse<ListingRow>>;
    getMenuOptions: (item: ListingRow) => MenuOption[];
};

const TRAJECTORY_COLUMN: ColumnConfig = {
    key: 'trajectoryName',
    title: 'Trajectory',
    sortable: false
};

const usePluginListing = ({
    pluginSlug,
    listingSlug,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn
}: UsePluginListingParams): UsePluginListingReturn => {
    const navigate = useNavigate();
    const { pluginListingRepository } = usePluginUseCases();
    const deleteAnalysis = useDeleteAnalysis();

    const storeColumns = usePluginListingStore((s) => s.columns);
    const setColumns = usePluginListingStore((s) => s.setColumns);
    const removeRowByAnalysisId = usePluginListingStore((s) => s.removeRowByAnalysisId);
    const reset = usePluginListingStore((s) => s.reset);

    const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;

    const columns = useMemo(() => {
        if (!shouldShowTrajectory) return storeColumns;
        return [TRAJECTORY_COLUMN, ...storeColumns];
    }, [storeColumns, shouldShowTrajectory]);

    const context: PluginListingContext = useMemo(() => ({
        pluginSlug,
        listingSlug,
        trajectoryId,
        teamId
    }), [pluginSlug, listingSlug, trajectoryId, teamId]);

    const fetchData = useCallback(async (
        params: { page: number; limit: number } & PluginListingContext
    ): Promise<PaginatedResponse<ListingRow>> => {
        const response = await pluginListingRepository.getListing({
            pluginSlug: params.pluginSlug,
            listingSlug: params.listingSlug,
            trajectoryId: params.trajectoryId,
            page: params.page,
            limit: params.limit
        });

        // Update columns from response metadata
        const cols = response._meta?.columns as ColumnConfig[] | undefined;
        if (cols) {
            setColumns(cols);
        }

        // Filter by analysisId if provided
        let filteredData = response.data;
        if (analysisId) {
            filteredData = response.data.filter((r) => r.analysisId === analysisId);
        }

        return {
            status: 'success',
            data: filteredData,
            pagination: response.pagination,
            _meta: response._meta
        };
    }, [pluginListingRepository, analysisId, setColumns]);

    const handleDelete = useCallback(async (item: ListingRow) => {
        const analysisToDelete = item?.analysisId;
        if (!analysisToDelete) {
            console.error('No analysis ID found for deletion');
            return;
        }

        const isConfirmed = confirm('Delete this analysis? This cannot be undone.');
        if (!isConfirmed) return;

        removeRowByAnalysisId(analysisToDelete);

        try {
            await deleteAnalysis(analysisToDelete);
        } catch {
            reset();
        }
    }, [deleteAnalysis, removeRowByAnalysisId, reset]);

    const getMenuOptions = useCallback((item: ListingRow): MenuOption[] => {
        const options: MenuOption[] = [];

        if (item?.trajectoryId && item?.analysisId && item?.exposureId && item?.timestep !== undefined) {
            options.push({
                label: 'Inspect Atoms',
                icon: RiEyeLine,
                onClick: () => navigate(
                    `/dashboard/trajectory/${item.trajectoryId}/analysis/${item.analysisId}/atoms/${item.exposureId}?timestep=${item.timestep}`
                )
            });
        }

        if (item?.analysisId) {
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDelete(item),
                destructive: true
            });
        }

        return options;
    }, [handleDelete, navigate]);

    const isEnabled = !!(pluginSlug && listingSlug && (trajectoryId || teamId));

    return {
        columns,
        context,
        isEnabled,
        fetchData,
        getMenuOptions
    };
};

export type { PluginListingContext };
export default usePluginListing;

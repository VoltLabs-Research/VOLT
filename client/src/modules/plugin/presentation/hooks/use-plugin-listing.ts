import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import usePluginListingStore from '../stores/use-plugin-listing-store';
import usePluginUseCases from './use-plugin-use-cases';
import useDeleteAnalysis from '@/modules/analysis/presentation/hooks/use-delete-analysis';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ExportType } from '@/shared/domain/export/types';
import type { ListingRow } from '../../domain/entities';

interface UsePluginListingParams {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    showTrajectoryColumn?: boolean;
};

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
    fetchData: (params: { page: number; limit: number } & PluginListingContext) => Promise<PaginatedResponse<ListingRow>>;
    exportData: (format: ExportType) => Promise<Blob>;
    getMenuOptions: (item: ListingRow) => MenuOption[];
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
        pluginId,
        exposureName,
        exposureId,
        trajectoryId,
        analysisId,
        teamId
    }), [pluginId, exposureName, exposureId, trajectoryId, analysisId, teamId]);

    const fetchData = useCallback(async (
        params: { page: number; limit: number } & PluginListingContext
    ): Promise<PaginatedResponse<ListingRow>> => {
        const response = await pluginListingRepository.getListing({
            pluginId: params.pluginId,
            exposureName: params.exposureName,
            exposureId: params.exposureId,
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            page: params.page,
            limit: params.limit
        });

        // Update columns from response metadata
        const cols = response._meta?.columns;
        if (cols?.length) {
            const normalizedColumns: ColumnConfig[] = cols.map((column: any) => {
                const title = String(column?.label || column?.title || column?.path || '');
                return {
                    key: title,
                    title,
                    sortable: Boolean(column?.sortable)
                };
            });

            setColumns(normalizedColumns);
        }

        return {
            status: 'success',
            data: response.data,
            pagination: response.pagination,
            _meta: response._meta
        };
    }, [pluginListingRepository, setColumns]);

    const exportData = useCallback(async (format: ExportType): Promise<Blob> => {
        return pluginListingRepository.exportListing({
            pluginId,
            exposureName,
            exposureId,
            trajectoryId,
            analysisId,
            format
        });
    }, [pluginListingRepository, pluginId, exposureName, exposureId, trajectoryId, analysisId]);

    const handleDelete = useCallback(async (item: ListingRow) => {
        const analysisToDelete = item.analysisId;
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

        if (item.trajectoryId && item.analysisId && item.timestep !== undefined) {
            options.push({
                label: 'Inspect Atoms',
                icon: RiEyeLine,
                onClick: () => navigate(
                    `/dashboard/trajectory/${item.trajectoryId}/analysis/${item.analysisId}/atoms?timestep=${item.timestep}`
                )
            });
        }

        if (item.analysisId) {
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDelete(item),
                destructive: true
            });
        }

        return options;
    }, [handleDelete, navigate]);

    const isEnabled = !!(pluginId && (exposureName || exposureId) && (trajectoryId || teamId));

    return {
        columns,
        context,
        isEnabled,
        fetchData,
        exportData,
        getMenuOptions
    };
};

export type { PluginListingContext };
export default usePluginListing;

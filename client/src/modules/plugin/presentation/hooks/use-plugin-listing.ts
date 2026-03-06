import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEyeLine, RiTableLine } from 'react-icons/ri';
import usePluginListingStore from '../stores/use-plugin-listing-store';
import usePluginUseCases from './use-plugin-services';
import useDeleteAnalysis from '@/modules/analysis/presentation/hooks/use-delete-analysis';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import { openModal } from '@/shared/presentation/components/Modal';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ExportType } from '@/shared/domain/export/types';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';
import type { ListingRow } from '../../domain/entities';
import formatSnakeCaseToTitle from '../utils/format-snake-case';

export const SUB_LISTING_MODAL_ID = 'sub-listing-modal';

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
    showTrajectoryColumn
}: UsePluginListingParams): UsePluginListingReturn => {
    const navigate = useNavigate();
    const { pluginListingRepository } = usePluginUseCases();
    const deleteAnalysis = useDeleteAnalysis();

    const storeColumns = usePluginListingStore((s) => s.columns);
    const setColumns = usePluginListingStore((s) => s.setColumns);
    const removeRowByAnalysisId = usePluginListingStore((s) => s.removeRowByAnalysisId);
    const reset = usePluginListingStore((s) => s.reset);
    const subListingNames = usePluginListingStore((s) => s.subListingNames);
    const setSubListingNames = usePluginListingStore((s) => s.setSubListingNames);
    const setSubListingParams = usePluginListingStore((s) => s.setSubListingParams);

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

        const metaSubListingNames = response._meta?.subListingNames;
        if (metaSubListingNames?.length) {
            setSubListingNames(metaSubListingNames);
        }

        return {
            status: 'success',
            data: response.data,
            pagination: response.pagination,
            _meta: response._meta
        };
    }, [pluginListingRepository, setColumns, setSubListingNames]);

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

        analysisIds.forEach((analysisId) => removeRowByAnalysisId(analysisId));

        try {
            await Promise.all(analysisIds.map((analysisId) =>
                showPromise(deleteAnalysis(analysisId), {
                    loading: { title: 'Deleting analysis...' },
                    success: { title: 'Analysis deleted' },
                    error: { title: 'Failed to delete analysis' }
                })
            ));
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
            reset();
        }
    }, [deleteAnalysis, removeRowByAnalysisId, reset]);

    const handleViewSubListing = useCallback((item: ListingRow, subListingName: string) => {
        if (!item.analysisId || !item.exposureId || item.timestep === undefined) return;

        setSubListingParams({
            analysisId: item.analysisId,
            exposureId: item.exposureId,
            timestep: item.timestep,
            subListingName
        });

        openModal(SUB_LISTING_MODAL_ID);
    }, [setSubListingParams]);

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

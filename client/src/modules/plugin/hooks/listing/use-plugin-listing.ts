import { useCallback, useMemo } from 'react';
import { fetchPluginListing, usePluginListingQuery } from './queries';
import useDeletePluginListingAnalyses from './use-delete-plugin-listing-analyses';
import { normalizeListingColumns } from '@/modules/plugin/utils/listing/normalize-listing-columns';
import { buildListingRowMenuOptions } from '@/modules/plugin/utils/listing/listing-row-menu-options';
import { useNavigate } from 'react-router-dom';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ListingRow } from '@volt/contracts/modules/plugin/listing';

interface PluginListingContext {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
}

interface UsePluginListingParams extends PluginListingContext {
    showTrajectoryColumn?: boolean;
}

const usePluginListing = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn
}: UsePluginListingParams) => {
    const navigate = useNavigate();
    const deleteRows = useDeletePluginListingAnalyses();

    // `context` is part of the pagination query key, so its identity must be stable.
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

    const listingMeta = listingMetaQuery.data?._meta;

    const columns = useMemo(
        () => normalizeListingColumns(listingMeta?.columns, showTrajectoryColumn ?? !trajectoryId),
        [listingMeta?.columns, showTrajectoryColumn, trajectoryId]
    );

    const fetchData = useCallback((params: { page: number; limit: number } & PluginListingContext) => {
        return fetchPluginListing({
            pluginId: params.pluginId,
            exposureName: params.exposureName,
            exposureId: params.exposureId,
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            page: params.page,
            limit: params.limit
        });
    }, []);

    const getMenuOptions = useCallback((item: ListingRow, selectedItems: ListingRow[]): MenuOption[] => {
        const targetRows = selectedItems.includes(item) ? selectedItems : [item];

        return buildListingRowMenuOptions({
            row: item,
            subListingNames: listingMeta?.subListingNames ?? [],
            navigate,
            allowRowNavigation: targetRows.length === 1,
            onDelete: () => deleteRows(targetRows)
        });
    }, [deleteRows, navigate, listingMeta?.subListingNames]);

    return {
        columns,
        context,
        isEnabled,
        resolvedExposureName: listingMeta?.exposureName ?? exposureName,
        fetchData,
        getMenuOptions
    };
};

export default usePluginListing;

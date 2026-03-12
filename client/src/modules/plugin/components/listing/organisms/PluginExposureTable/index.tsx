import { useCallback } from 'react';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import SubListingModal from '@/modules/plugin/components/listing/organisms/SubListingModal';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import { SUB_LISTING_MODAL_ID } from '@/modules/plugin/hooks/listing/use-plugin-listing';
import usePluginSubListing from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';
import useDeletePluginListingAnalyses from '@/modules/plugin/hooks/listing/use-delete-plugin-listing-analyses';
import { openModal } from '@/shared/presentation/components/Modal';
import usePluginListing from '@/modules/plugin/hooks/listing/use-plugin-listing';
import type { ReactNode } from 'react';
import type { PluginSubListingParams } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';

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
};

const PluginExposureTable = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn,
    headerActions,
    compact
}: PluginExposureTableProps) => {
    const {
        subListingParams,
        setSubListingParams,
        resetSubListing
    } = usePluginSubListing();
    const deleteRows = useDeletePluginListingAnalyses();

    const openSubListing = useCallback((params: PluginSubListingParams) => {
        setSubListingParams(params);
        openModal(SUB_LISTING_MODAL_ID);
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
                    teamId,
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
                compact={compact}
                hideHeader={compact}
            />
            <SubListingModal
                subListingParams={subListingParams}
                onClose={resetSubListing}
            />
        </>
    );
};

export default PluginExposureTable;

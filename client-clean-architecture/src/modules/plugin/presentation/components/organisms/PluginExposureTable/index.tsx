import DocumentListing from '@/shared/presentation/components/DocumentListing';
import usePluginListing from '../../../hooks/use-plugin-listing';
import type { PluginListingContext } from '../../../hooks/use-plugin-listing';
import type { ListingRow } from '../../../../domain/entities';
import './PluginExposureTable.css';

export interface PluginExposureTableProps {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    showTrajectoryColumn?: boolean;
    headerActions?: React.ReactNode;
};

const PluginExposureTable = ({
    pluginSlug,
    listingSlug,
    trajectoryId,
    analysisId,
    teamId,
    showTrajectoryColumn,
    headerActions
}: PluginExposureTableProps) => {
    const {
        columns,
        data,
        context,
        isEnabled,
        fetchData,
        onDataFetched,
        onContextChange,
        getMenuOptions
    } = usePluginListing({
        pluginSlug,
        listingSlug,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn
    });

    return (
        <DocumentListing<ListingRow, PluginListingContext>
            title={listingSlug}
            columns={columns}
            data={data}
            fetchData={fetchData}
            onDataFetched={onDataFetched}
            context={context}
            onContextChange={onContextChange}
            defaultLimit={50}
            enabled={isEnabled}
            getMenuOptions={getMenuOptions}
            headerActions={headerActions}
            emptyMessage={!isEnabled ? 'Please select a team or trajectory first.' : 'No documents found.'}
        />
    );
};

export default PluginExposureTable;

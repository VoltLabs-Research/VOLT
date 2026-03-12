import PluginCompactTable from '@/modules/plugin/components/listing/organisms/PluginCompactTable';
import { usePluginSubListingData } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing-data';
import { useMemo } from 'react';

import type { PluginSubListingParams } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';

interface PluginSubListingPanelProps extends PluginSubListingParams {}

const PluginSubListingPanel = ({
    analysisId,
    exposureId,
    timestep,
    subListingName
}: PluginSubListingPanelProps) => {
    const subListingParams = useMemo(() => ({
        analysisId,
        exposureId,
        timestep,
        subListingName
    }), [analysisId, exposureId, subListingName, timestep]);

    const {
        columns,
        rows,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        error,
        handleLoadMore
    } = usePluginSubListingData(subListingParams);

    const errorMessage = error
        ? (error instanceof Error ? error : 'Failed to load sub-listing data.')
        : null;

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            hasMore={hasNextPage}
            onLoadMore={handleLoadMore}
            error={errorMessage}
        />
    );
};

export default PluginSubListingPanel;

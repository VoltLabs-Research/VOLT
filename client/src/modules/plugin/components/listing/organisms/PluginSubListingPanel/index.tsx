import DocumentListingTable from '@/shared/presentation/components/DocumentListingTable';
import { usePluginSubListingData } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing-data';
import { useMemo } from 'react';

import type { PluginSubListingParams } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';

interface PluginSubListingPanelProps extends PluginSubListingParams {};

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
        errorMessage,
        handleLoadMore
    } = usePluginSubListingData(subListingParams);

    return (
        <DocumentListingTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            hasMore={hasNextPage}
            onLoadMore={handleLoadMore}
            errorMessage={errorMessage}
            compact
        />
    );
};

export default PluginSubListingPanel;

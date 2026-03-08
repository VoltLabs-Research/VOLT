import { useMemo, useState, useCallback } from 'react';

export interface PluginSubListingParams {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
}

const usePluginSubListing = () => {
    const [subListingParams, setSubListingParams] = useState<PluginSubListingParams | null>(null);

    const resetSubListing = useCallback(() => {
        setSubListingParams(null);
    }, []);

    return useMemo(() => ({
        subListingParams,
        setSubListingParams,
        resetSubListing
    }), [resetSubListing, subListingParams]);
};

export default usePluginSubListing;

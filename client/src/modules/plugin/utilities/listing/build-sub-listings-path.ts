interface BuildSubListingsPathParams {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingNames: string[];
    activeSubListingName?: string;
};

export const buildSubListingsPath = ({
    trajectoryId,
    analysisId,
    exposureId,
    timestep,
    subListingNames,
    activeSubListingName
}: BuildSubListingsPathParams): string => {
    const searchParams = new URLSearchParams({
        exposureId,
        timestep: String(timestep),
        names: subListingNames.join(',')
    });

    if(activeSubListingName && subListingNames.includes(activeSubListingName)){
        searchParams.set('tab', activeSubListingName);
    }

    return `/dashboard/trajectory/${trajectoryId}/analysis/${analysisId}/sub-listings?${searchParams.toString()}`;
};

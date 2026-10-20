import type { IExposureComputed } from '@volt/contracts/modules/plugin/exposure';

interface ListingRelevantExposure {
    exposureId: string;
    name: string;
}

export const getListingRelevantExposures = (
    exposures: IExposureComputed[] | undefined | null
): ListingRelevantExposure[] => {
    return (exposures ?? [])
        .filter((exposure) => exposure.hasListing !== false)
        .map((exposure) => ({
            exposureId: exposure._id,
            name: exposure.name
        }));
};

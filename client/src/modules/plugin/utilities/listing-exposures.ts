import type { IExposureComputed } from '../api/entities/exposure';

export interface ListingRelevantExposure {
    exposureId: string;
    name: string;
}

export const getListingRelevantExposures = (
    exposures: IExposureComputed[] | undefined | null
): ListingRelevantExposure[] => {
    if (!Array.isArray(exposures) || exposures.length === 0) {
        return [];
    }

    return exposures
        .filter((exposure) => Boolean(exposure?._id) && Boolean(exposure?.name) && exposure?.hasListing)
        .map((exposure) => ({
            exposureId: exposure._id,
            name: exposure.name
        }));
};

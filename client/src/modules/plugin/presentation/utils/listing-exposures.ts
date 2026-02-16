import type { IExposureComputed } from '../../domain/entities/Exposure';

export interface ListingRelevantExposure {
    exposureId: string;
    name: string;
}

const hasListingMetadata = (listing: IExposureComputed['listing']): boolean => {
    return Boolean(listing && typeof listing === 'object' && Object.keys(listing).length > 0);
};

export const getListingRelevantExposures = (
    exposures: IExposureComputed[] | undefined | null
): ListingRelevantExposure[] => {
    if (!Array.isArray(exposures) || exposures.length === 0) {
        return [];
    }

    return exposures
        .filter((exposure) => Boolean(exposure?._id) && Boolean(exposure?.name) && hasListingMetadata(exposure?.listing))
        .map((exposure) => ({
            exposureId: exposure._id,
            name: exposure.name
        }));
};

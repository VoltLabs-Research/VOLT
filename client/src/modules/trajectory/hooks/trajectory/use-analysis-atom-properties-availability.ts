import { colorCodingPropertiesQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import { useMemo } from 'react';

interface UseAnalysisAtomPropertiesAvailabilityParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
}

interface UseAnalysisAtomPropertiesAvailabilityResult {
    hasAtomProperties: boolean;
    error: Error | null;
}

/** Uses the backend modifier-properties discovery endpoint as the source of truth for per-atom availability. */
const useAnalysisAtomPropertiesAvailability = ({
    trajectoryId,
    analysisId,
    timestep
}: UseAnalysisAtomPropertiesAvailabilityParams): UseAnalysisAtomPropertiesAvailabilityResult => {
    const isEnabled = Boolean(trajectoryId && analysisId && analysisId !== 'default' && timestep !== undefined);

    const atomPropertiesQuery = colorCodingPropertiesQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId,
            timestep: timestep ?? 0
        },
        {
            enabled: isEnabled
        }
    );

    const atomPropertiesByExposureId = atomPropertiesQuery.data?.modifiers ?? {};
    const hasAtomProperties = useMemo(() => {
        return Object.values(atomPropertiesByExposureId).some((properties) => properties.length > 0);
    }, [atomPropertiesByExposureId]);

    return {
        hasAtomProperties,
        error: atomPropertiesQuery.error ?? null
    };
};

export default useAnalysisAtomPropertiesAvailability;

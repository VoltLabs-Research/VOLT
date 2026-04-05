import { formatValueForPath } from '@shared/infrastructure/utilities/format-value';

const DEFAULT_ANALYSIS_ID = 'default';

export const buildColorCodingObjectName = (
    trajectoryId: string,
    analysisSegment: string | undefined,
    timestep: string | number,
    exposureId: string | undefined,
    property: string,
    startValue: number,
    endValue: number,
    gradient: string
): string => {
    const segment = analysisSegment || DEFAULT_ANALYSIS_ID;
    const formattedStart = formatValueForPath(startValue);
    const formattedEnd = formatValueForPath(endValue);
    return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${formattedStart}-${formattedEnd}/${gradient}.glb.zst`;
};

export const buildParticleFilterObjectName = (
    trajectoryId: string,
    analysisSegment: string | undefined,
    timestep: string | number,
    exposureId: string | undefined,
    property: string,
    operator: string,
    value: number | string,
    action: string
): string => {
    const segment = analysisSegment || DEFAULT_ANALYSIS_ID;
    const formattedValue = typeof value === 'number' ? formatValueForPath(value) : String(value);
    const exposurePart = exposureId ? String(exposureId) : 'dump';
    return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/particle-filter/${exposurePart}/${property}-${operator}-${formattedValue}-${action}.glb.zst`;
};

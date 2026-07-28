export const buildLineSceneSourceKey = (
    trajectoryId: string,
    analysisId: string,
    timestep: number,
    exposureId: string
): string => {
    return `trajectory-${trajectoryId}/analysis-${analysisId}/scene-sources/${timestep}/${exposureId}.lines.parquet`;
};

export interface LineEntityRange {
    id: number;
    triangleStart: number;
    triangleCount: number;
}

export interface LineEntityRangesSidecar {
    version: 1;
    entities: LineEntityRange[];
}

export const buildLineRangesSidecarKey = (glbObjectKey: string): string => (
    `${glbObjectKey.replace(/\.zst$/, '')}.ranges.json`
);

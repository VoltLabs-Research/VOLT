// The restyle source for line exposures is the exposure's own line entity
// table (Parquet), persisted next to the baked GLB so styled re-exports never
// require re-running the analysis. One artifact serves both the GLB rebuild
// and every property query.
export const buildLineSceneSourceKey = (
    trajectoryId: string,
    analysisId: string,
    timestep: number,
    exposureId: string
): string => {
    return `trajectory-${trajectoryId}/analysis-${analysisId}/scene-sources/${timestep}/${exposureId}.lines.parquet`;
};

// Triangle ranges per line entity, uploaded beside each generated GLB as
// `<glb-key>.ranges.json`. Lets clients resolve a picked triangle back to the
// entity id and query its properties.
export interface LineEntityRange {
    id: number;
    triangleStart: number;
    triangleCount: number;
}

export interface LineEntityRangesSidecar {
    version: 1;
    entities: LineEntityRange[];
}

export const buildLineRangesSidecarKey = (glbObjectKey: string): string => `${glbObjectKey}.ranges.json`;

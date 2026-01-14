export interface StatsResult {
    min: number;
    max: number;
}

export interface NativeStats {
    getStatsForProperty(
        filePath: string, 
        propIdx: number
    ): StatsResult;

    getMinMaxFromTypedArray(
        arr: Float32Array | Float64Array | Int32Array | Uint32Array
    ): StatsResult | undefined;

    computeMagnitudes(
        vectors: any[]
    ): Float32Array | undefined;
}

import path from 'path';

interface StatsResult {
    min: number;
    max: number;
}

interface NativeModule {
    getStatsForProperty(filePath: string, propIdx: number): StatsResult;
    getMinMaxFromTypedArray(arr: Float32Array | Float64Array | Int32Array | Uint32Array): StatsResult | undefined;
    computeMagnitudes(vectors: any[]): Float32Array | undefined;
}

const nativePath = path.join(process.cwd(), 'native/build/Release/stats_parser.node');
const nativeModule: NativeModule = require(nativePath);

export function getStatsNative(filePath: string, propIdx: number): StatsResult {
    return nativeModule.getStatsForProperty(filePath, propIdx);
}

export function getMinMaxNative(arr: Float32Array | Float64Array | Int32Array | Uint32Array): StatsResult | undefined {
    return nativeModule.getMinMaxFromTypedArray(arr);
}

export function computeMagnitudesNative(vectors: any[]): Float32Array | undefined {
    return nativeModule.computeMagnitudes(vectors);
}



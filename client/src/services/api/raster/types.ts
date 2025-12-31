export interface RasterMetadata {
    trajectoryId: string;
    analysisId: string;
    totalFrames: number;
    [key: string]: any;
}

export interface RasterFrameData {
    [key: string]: any;
}

export interface ColorCodingStats {
    min: number;
    max: number;
    average: number;
    [key: string]: any;
}

export interface ColorCodingPayload {
    property: string;
    colorScheme?: string;
    range?: [number, number];
    startValue?: number;
    endValue?: number;
    gradient?: string;
    exposureId?: string;
}

export interface ColorCodingProperties{
    base: string[];
    modifiers: Record<string, string[]>;
};
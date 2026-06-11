import { Readable } from 'node:stream';

// Native-daemon contracts shared by the daemon port, the line-style port and
// their infrastructure adapters. These are plain, framework-agnostic data
// shapes and belong to the domain: previously they lived inside the concrete
// `TrajectoryNativeDaemonService` (infrastructure), which made the domain ports
// import from infrastructure and inverted the dependency rule.

export interface LineStyleFilterParam {
    property: string;
    operator: 'gte' | 'lte' | 'eq' | 'neq';
    value: number | string;
};

// Property-generic line styling: every knob names a discovered per-entity
// property of the exposure's line table.
export interface LineStyleParams {
    lineWidth?: number;
    tubularSegments?: number;
    colorMode?: 'category' | 'uniform' | 'gradient';
    colorProperty?: string;
    categoryColors?: Record<string, [number, number, number, number]>;
    categoryVisibility?: Record<string, boolean>;
    uniformColor?: [number, number, number, number];
    gradient?: string;
    startValue?: number;
    endValue?: number;
    filters?: LineStyleFilterParam[];
};

// Export-node options from the plugin definition (colorBy, propertyColors,
// material); the style overlays them on the daemon.
export interface LineExportBaseOptions {
    lineWidth?: number;
    tubularSegments?: number;
    colorBy?: string;
    propertyColors?: Record<string, [number, number, number, number]>;
    material?: Record<string, unknown>;
};

export interface TrajectoryNativeLineModelResponse {
    objectKey: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
};

export interface TrajectoryNativeObjectStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
};

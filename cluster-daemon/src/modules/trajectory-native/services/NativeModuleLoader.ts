import path from 'node:path';

export interface NativeDumpResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
};

export interface NativeDataResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
};

export interface ParseOptions {
    includeIds?: boolean;
    properties?: string[];
};

export interface ParsedTrajectory {
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
        simulationCell: {
            boundingBox: {
                width: number;
                height: number;
                length: number;
            };
            geometry: {
                cell_vectors: number[][];
                cell_origin: number[];
                periodic_boundary_conditions: {
                    x: boolean;
                    y: boolean;
                    z: boolean;
                };
            };
        };
    };
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
    min: [number, number, number];
    max: [number, number, number];
};

export interface NativeTrajectoryRequest {
    trajectoryId: string;
    timestep: number;
    objectKey?: string;
};

export interface NativePropertyStatsRequest extends NativeTrajectoryRequest {
    property: string;
};

export interface NativeUniqueValuesRequest extends NativePropertyStatsRequest {
    maxValues?: number;
};

export interface NativeAtomsPageRequest extends NativeTrajectoryRequest {
    page: number;
    limit: number;
};

export interface NativeColorModelRequest extends NativePropertyStatsRequest {
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValuesBase64?: string;
};

export interface NativeFilterPreviewRequest extends NativeTrajectoryRequest {
    property: string;
    operator: string;
    value: number;
    externalValuesBase64?: string;
};

export interface NativeParticleFilterModelRequest extends NativeTrajectoryRequest {
    objectKey: string;
    action: 'delete' | 'highlight';
    maskBase64: string;
};

export interface NativeAtomsPageResponse {
    atoms: NativeAtomPageEntry[];
    totalAtoms: number;
};

export interface NativeAtomPageEntry {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
};

export interface NativeFilterPreviewResponse {
    maskBase64: string;
    matchCount: number;
    totalAtoms: number;
};

export interface RasterizePreviewInput {
    inputBucket: string;
    inputObjectKey: string;
    outputObjectKey: string;
};

export interface NativeDumpParserModule {
    parseDump(filePath: string, options: ParseOptions): NativeDumpResult | undefined;
};

export interface NativeDataParserModule {
    parseData(filePath: string, options: { includeIds?: boolean; }): NativeDataResult | undefined;
};

export interface NativeStatsModule {
    getStatsForProperty(filePath: string, propIdx: number): NativeStatsResult;
    getUniqueValuesForProperty(filePath: string, propIdx: number, maxValues?: number): number[];
};

export interface NativeStatsResult {
    min: number;
    max: number;
};

export interface NativeExporterModule {
    generateGLBToFile(
        positions: Float32Array,
        types: Uint16Array,
        min: [number, number, number],
        max: [number, number, number],
        outputPath: string
    ): boolean;
    applyPropertyColors(
        values: Float32Array,
        minValue: number,
        maxValue: number,
        gradientType: number
    ): Float32Array;
    generatePointCloudGLB(
        positions: Float32Array,
        colors: Float32Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;
    generateGLB(
        positions: Float32Array,
        types: Uint16Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;
    taubinSmooth(
        positions: Float32Array,
        indices: Uint32Array,
        iterations: number
    ): boolean;
    generateMeshGLB(
        positions: Float32Array,
        normals: Float32Array,
        indices: Uint16Array | Uint32Array,
        hasColors: boolean,
        colors: Float32Array | undefined,
        bounds: {
            minX: number;
            minY: number;
            minZ: number;
            maxX: number;
            maxY: number;
            maxZ: number;
        },
        material: {
            baseColor: [number, number, number, number];
            metallic: number;
            roughness: number;
            emissive: [number, number, number];
            doubleSided?: boolean;
        }
    ): Buffer;
};

export interface NativeRasterizerModule {
    rasterize(
        glbPath: string,
        pngPath: string,
        width: number,
        height: number,
        azimuth: number,
        elevation: number,
        options: NativeRasterizerOptions
    ): boolean;
};

export interface NativeRasterizerOptions {
    fov: number;
    distScale: number;
    zUp: boolean;
};

export class NativeModuleLoader {
    private dumpParserModule: NativeDumpParserModule | null = null;
    private dataParserModule: NativeDataParserModule | null = null;
    private statsModule: NativeStatsModule | null = null;
    private exporterModule: NativeExporterModule | null = null;
    private rasterizerModule: NativeRasterizerModule | null = null;

    getDumpParserModule(): NativeDumpParserModule {
        if (!this.dumpParserModule) {
            this.dumpParserModule = require(this.getNativeModulePath('dump_parser.node'));
        }

        const module = this.dumpParserModule;
        if (!module) {
            throw new Error('Native dump parser module is not available');
        }

        return module;
    }

    getDataParserModule(): NativeDataParserModule {
        if (!this.dataParserModule) {
            this.dataParserModule = require(this.getNativeModulePath('data_parser.node'));
        }

        const module = this.dataParserModule;
        if (!module) {
            throw new Error('Native data parser module is not available');
        }

        return module;
    }

    getStatsModule(): NativeStatsModule {
        if (!this.statsModule) {
            this.statsModule = require(this.getNativeModulePath('stats_parser.node'));
        }

        const module = this.statsModule;
        if (!module) {
            throw new Error('Native stats module is not available');
        }

        return module;
    }

    getExporterModule(): NativeExporterModule {
        if (!this.exporterModule) {
            this.exporterModule = require(this.getNativeModulePath('glb_exporter.node'));
        }

        const module = this.exporterModule;
        if (!module) {
            throw new Error('Native exporter module is not available');
        }

        return module;
    }

    getRasterizerModule(): NativeRasterizerModule {
        if (!this.rasterizerModule) {
            this.rasterizerModule = require(this.getNativeModulePath('rasterizer.node'));
        }

        const module = this.rasterizerModule;
        if (!module) {
            throw new Error('Native rasterizer module is not available');
        }

        return module;
    }

    private getNativeModulePath(fileName: string): string {
        return path.resolve(process.cwd(), 'native', 'build', 'Release', fileName);
    }
};

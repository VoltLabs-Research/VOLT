import { logger } from '@/core/logger';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface NativeBoxBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
};

export interface NativeTrajectoryMetadata {
    timestep: number;
    natoms: number;
    headers: string[];
    boxBounds?: NativeBoxBounds;
};

export interface NativeDumpResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    /** Additional per-atom columns returned by the dump parser when requested and available. */
    properties?: Record<string, Float32Array>;
    metadata: NativeTrajectoryMetadata;
    min: [number, number, number];
    max: [number, number, number];
};

export interface NativeDataResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    metadata: NativeTrajectoryMetadata;
    min: [number, number, number];
    max: [number, number, number];
};

export interface ParseOptions {
    includeIds?: boolean;
    /** Additional dump columns to materialize beyond the built-in id/type/x/y/z fields. */
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
    ownerClusterId?: string;
    teamId?: string;
    trajectoryName?: string;
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

interface NativeModifierSourceRequest {
    analysisId?: string;
    exposureId?: string;
};

export interface NativeColorModelRequest extends NativePropertyStatsRequest, NativeModifierSourceRequest {
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValuesBase64?: string;
};

export interface NativeConditionFilterPreviewRequest extends NativeTrajectoryRequest, NativeModifierSourceRequest {
    property: string;
    operator: string;
    value: number;
    externalValuesBase64?: string;
};
export type NativeFilterPreviewRequest = NativeConditionFilterPreviewRequest;

export interface NativeParticleFilterModelRequest extends NativeTrajectoryRequest {
    objectKey: string;
    action: 'delete' | 'highlight';
    maskBase64: string;
};

export interface NativeAtomsPageResponse {
    atoms: NativeAtomPageEntry[];
    totalAtoms: number;
    nativeProperties: string[];
};

export interface NativeAtomPageEntry {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number;
};

export interface NativeFilterPreviewResponse {
    maskBase64: string;
    matchCount: number;
    totalAtoms: number;
};

export interface RasterizePreviewInput {
    inputBucket: string;
    inputObjectKey: string;
    inputOwnerClusterId?: string;
    outputObjectKey: string;
    outputOwnerClusterId?: string;
};

interface LammpsIoModule {
    dataParser: NativeDataParserModule;
    dumpParser: NativeDumpParserModule;
    statsParser: NativeStatsModule;
};

export interface NativeModuleOperationContext {
    filePath?: string;
    objectKey?: string;
    packageName?: string;
    pngPath?: string;
    tempGlbPath?: string;
    timestep?: number;
    trajectoryId?: string;
};

export enum NativeModuleOperation {
    ExportGlb = 'export-glb',
    ParseTrajectory = 'parse-trajectory',
    PropertyStats = 'property-stats',
    RasterizeGlb = 'rasterize-glb',
    UniqueValues = 'unique-values'
};

enum NativePackageName {
    HeadlessRasterizer = '@voltstack/headless-rasterizer',
    LammpsIo = '@voltstack/lammps-io',
    SpatialAssembler = '@voltstack/spatial-assembler'
}

export const NATIVE_PROCESSING_RUNTIME_DIR = path.join(process.cwd(), '.runtime', 'native-processing');

export const createNativeProcessingTempPath = (extension: string): string => {
    return path.join(NATIVE_PROCESSING_RUNTIME_DIR, `${randomUUID()}${extension}`);
};

export interface NativeDumpParserModule {
    parseDump(filePath: string, options: ParseOptions): NativeDumpResult | undefined;
};

export interface NativeDataParserModule {
    parseData(filePath: string, options: NativeDataParseOptions): NativeDataResult | undefined;
};

export interface NativeStatsModule {
    getStatsForProperty(filePath: string, propIdx: number): NativeStatsResult;
    getUniqueValuesForProperty(filePath: string, propIdx: number, maxValues?: number): number[];
};

export interface NativeStatsResult {
    min: number;
    max: number;
};

export interface NativeMeshBounds {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
};

export interface NativeMeshMaterial {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
    doubleSided?: boolean;
};

export interface NativeDataParseOptions {
    includeIds?: boolean;
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
        bounds: NativeMeshBounds,
        material: NativeMeshMaterial
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
    private lammpsIoModule: LammpsIoModule | null = null;
    private exporterModule: NativeExporterModule | null = null;
    private rasterizerModule: NativeRasterizerModule | null = null;
    private readonly observedOperations = new Set<NativeModuleOperation>();
    private readonly observedPackages = new Set<NativePackageName>();
    private hasLoggedEnvironment = false;

    getDumpParserModule(): NativeDumpParserModule {
        const module = this.getLammpsIoModule().dumpParser;
        if (!module) {
            throw new Error('Native dump parser module is not available');
        }

        return module;
    }

    getDataParserModule(): NativeDataParserModule {
        const module = this.getLammpsIoModule().dataParser;
        if (!module) {
            throw new Error('Native data parser module is not available');
        }

        return module;
    }

    getStatsModule(): NativeStatsModule {
        const module = this.getLammpsIoModule().statsParser;
        if (!module) {
            throw new Error('Native stats module is not available');
        }

        return module;
    }

    getExporterModule(): NativeExporterModule {
        if (!this.exporterModule) {
            this.exporterModule = this.loadPackage(NativePackageName.SpatialAssembler);
        }

        const module = this.exporterModule;
        if (!module) {
            throw new Error('Native exporter module is not available');
        }

        return module;
    }

    getRasterizerModule(): NativeRasterizerModule {
        if (!this.rasterizerModule) {
            this.rasterizerModule = this.loadPackage(NativePackageName.HeadlessRasterizer);
        }

        const module = this.rasterizerModule;
        if (!module) {
            throw new Error('Native rasterizer module is not available');
        }

        return module;
    }

    private getLammpsIoModule(): LammpsIoModule {
        if (!this.lammpsIoModule) {
            this.lammpsIoModule = this.loadPackage(NativePackageName.LammpsIo);
        }

        const module = this.lammpsIoModule;
        if (!module) {
            throw new Error('LAMMPS native module package is not available');
        }

        return module;
    }

    traceOperation(
        operation: NativeModuleOperation,
        context: NativeModuleOperationContext = {}
    ): void {
        this.logEnvironmentOnce();

        if (this.observedOperations.has(operation)) {
            return;
        }

        this.observedOperations.add(operation);
        logger.info(
            {
                operation,
                ...context
            },
            'Preparing first native trajectory operation'
        );
    }

    private logEnvironmentOnce(): void {
        if (this.hasLoggedEnvironment) {
            return;
        }

        this.hasLoggedEnvironment = true;
        logger.info(
            {
                arch: process.arch,
                cwd: process.cwd(),
                execPath: process.execPath,
                napiVersion: process.versions.napi,
                nodeVersion: process.version,
                nodeModuleVersion: process.versions.modules,
                pid: process.pid,
                platform: process.platform
            },
            'Native trajectory runtime initialized'
        );
    }

    private loadPackage<T>(packageName: NativePackageName): T {
        this.logEnvironmentOnce();

        const startTime = Date.now();

        if (!this.observedPackages.has(packageName)) {
            this.observedPackages.add(packageName);
            logger.info(
                {
                    packageName
                },
                'Loading native module package'
            );
        }

        let resolvedPath: string = packageName;

        try {
            resolvedPath = require.resolve(packageName);
            const loadedPackage = require(packageName);

            logger.info(
                {
                    durationMs: Date.now() - startTime,
                    packageName,
                    resolvedPath
                },
                'Native module package loaded'
            );

            if (loadedPackage?.default) {
                return loadedPackage.default;
            }

            return loadedPackage;
        } catch (error: unknown) {
            logger.error(
                {
                    durationMs: Date.now() - startTime,
                    err: error,
                    packageName,
                    resolvedPath
                },
                'Failed to load native module package'
            );
            throw error;
        }
    }
};

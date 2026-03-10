import { ObjectBucketName, type AnalysisExposureDefinition, type AnalysisJobExecutionData } from '../../../shared/contracts';
import { logger } from '../../../core/logger';
import { MinioService } from '../../platform/services';
import { upsertSceneArtifactByObjectName } from '../repositories/SceneArtifactRepository';
import { NativeModuleLoader } from '../../trajectory-native/services';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter' | 'ChartExporter';

interface PrimitiveAtom {
    id: number;
    pos: [number, number, number];
};

interface AtomsGroupedByType {
    [typeName: string]: PrimitiveAtom[];
};

interface MeshFacet {
    vertices: [number, number, number];
};

interface MeshInput {
    vertices: Array<{
        index: number;
        position: [number, number, number];
    }>;
    facets: MeshFacet[];
};

interface ExportMaterial {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
};

interface MeshExportOptions {
    generateNormals?: boolean;
    enableDoubleSided?: boolean;
    smoothIterations?: number;
    material?: ExportMaterial;
};

interface DislocationExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: ExportMaterial;
    colorByType?: boolean;
    typeColors?: Record<string, [number, number, number, number]>;
};

interface ChartExportOptions {
    xAxisKey: string;
    yAxisKey: string;
    chartType: 'line' | 'bar' | 'scatter' | 'area';
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    lineColor?: string;
    fillColor?: string;
    showLegend?: boolean;
    showGrid?: boolean;
};

interface ChartPoint {
    x: unknown;
    y: number;
};

export interface ExportExecutionInput {
    executionData: AnalysisJobExecutionData;
    exposure: AnalysisExposureDefinition;
    decodedPayload: Record<string, unknown>;
    timestep: number;
    teamClusterId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getNestedValue = (data: unknown, key: string): unknown => {
    if (!key) {
        return data;
    }

    return key.split('.').reduce<unknown>((current, segment) => {
        if (!isRecord(current)) {
            return undefined;
        }

        return current[segment];
    }, data);
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
    const numericValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toStringMap = (value: unknown): Record<string, unknown> => {
    return isRecord(value) ? value : {};
};

const buildObjectPath = (input: ExportExecutionInput, exporter: ExporterName, type: string): string => {
    const isChart = exporter === 'ChartExporter' || type === 'chart-png';
    const folder = isChart ? 'charts' : 'glb';
    const extension = isChart ? 'png' : type;

    return `trajectory-${input.executionData.trajectoryId}/analysis-${input.executionData.analysisId}/${folder}/${input.timestep}/${input.exposure.nodeId}.${extension}`;
};

const normalizeAtomsByType = (value: Record<string, unknown>): AtomsGroupedByType => {
    const result: AtomsGroupedByType = {};

    for (const [typeName, atoms] of Object.entries(value)) {
        if (!Array.isArray(atoms)) {
            continue;
        }

        const normalized = atoms
            .map((atom, index) => {
                if (!isRecord(atom) || !Array.isArray(atom.pos) || atom.pos.length < 3) {
                    return null;
                }

                return {
                    id: toFiniteNumber(atom.id, index),
                    pos: [
                        toFiniteNumber(atom.pos[0]),
                        toFiniteNumber(atom.pos[1]),
                        toFiniteNumber(atom.pos[2])
                    ] as [number, number, number]
                };
            })
            .filter((atom): atom is PrimitiveAtom => atom !== null);

        if (normalized.length > 0) {
            result[typeName] = normalized;
        }
    }

    return result;
};

const normalizeDislocationAsAtoms = (
    value: Record<string, unknown>,
    typeColors?: Record<string, [number, number, number, number]>,
    colorByType = true
): AtomsGroupedByType => {
    const result: AtomsGroupedByType = {};
    const segments = Array.isArray(value.segments) ? value.segments : Array.isArray(value) ? value : [];
    let atomIndex = 0;

    for (const segment of segments) {
        if (!isRecord(segment)) {
            continue;
        }

        const points = Array.isArray(segment.points)
            ? segment.points
            : Array.isArray(segment.polyline)
                ? segment.polyline
                : [];
        const typeName = colorByType && typeof segment.type === 'string'
            ? segment.type
            : 'dislocation';
        const atoms = result[typeName] || [];

        for (const point of points) {
            if (!Array.isArray(point) || point.length < 3) {
                continue;
            }

            atoms.push({
                id: atomIndex++,
                pos: [
                    toFiniteNumber(point[0]),
                    toFiniteNumber(point[1]),
                    toFiniteNumber(point[2])
                ]
            });
        }

        if (atoms.length > 0) {
            result[typeName] = atoms;
        }
    }

    if (Object.keys(result).length === 0 && Array.isArray(value.points)) {
        result.dislocation = value.points
            .filter((point): point is [number, number, number] => Array.isArray(point) && point.length >= 3)
            .map((point, index) => ({
                id: index,
                pos: [toFiniteNumber(point[0]), toFiniteNumber(point[1]), toFiniteNumber(point[2])]
            }));
    }

    if (typeColors && Object.keys(typeColors).length > 0) {
        return result;
    }

    return result;
};

const colorForType = (typeName: string, typeIndex: number): [number, number, number] => {
    const predefined: Record<string, [number, number, number]> = {
        bcc: [0.2, 0.6, 1],
        fcc: [1, 0.5, 0.2],
        hcp: [0.4, 0.9, 0.4],
        dislocation: [1, 0.2, 0.2]
    };

    const normalized = typeName.toLowerCase();
    if (predefined[normalized]) {
        return predefined[normalized];
    }

    const palette: Array<[number, number, number]> = [
        [0.91, 0.30, 0.24],
        [0.20, 0.60, 0.86],
        [0.18, 0.80, 0.44],
        [0.95, 0.77, 0.06],
        [0.61, 0.35, 0.71]
    ];

    return palette[typeIndex % palette.length];
};

const buildPointCloudData = (atomsByType: AtomsGroupedByType): {
    positions: Float32Array;
    colors: Float32Array;
    min: [number, number, number];
    max: [number, number, number];
} => {
    const typeEntries = Object.entries(atomsByType);
    const totalAtoms = typeEntries.reduce((count, [, atoms]) => count + atoms.length, 0);
    if (totalAtoms === 0) {
        throw new Error('No atom data available for export');
    }

    const positions = new Float32Array(totalAtoms * 3);
    const colors = new Float32Array(totalAtoms * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let offset = 0;

    typeEntries.forEach(([typeName, atoms], typeIndex) => {
        const color = colorForType(typeName, typeIndex);
        for (const atom of atoms) {
            const base = offset * 3;
            positions[base] = atom.pos[0];
            positions[base + 1] = atom.pos[1];
            positions[base + 2] = atom.pos[2];
            colors[base] = color[0];
            colors[base + 1] = color[1];
            colors[base + 2] = color[2];
            min[0] = Math.min(min[0], atom.pos[0]);
            min[1] = Math.min(min[1], atom.pos[1]);
            min[2] = Math.min(min[2], atom.pos[2]);
            max[0] = Math.max(max[0], atom.pos[0]);
            max[1] = Math.max(max[1], atom.pos[1]);
            max[2] = Math.max(max[2], atom.pos[2]);
            offset += 1;
        }
    });

    return { positions, colors, min, max };
};

const normalizeMesh = (value: Record<string, unknown>): MeshInput => {
    const vertices = Array.isArray(value.vertices) ? value.vertices : [];
    const facets = Array.isArray(value.facets) ? value.facets : [];

    return {
        vertices: vertices
            .map((vertex) => {
                if (!isRecord(vertex) || !Array.isArray(vertex.position) || vertex.position.length < 3) {
                    return null;
                }

                return {
                    index: toFiniteNumber(vertex.index),
                    position: [
                        toFiniteNumber(vertex.position[0]),
                        toFiniteNumber(vertex.position[1]),
                        toFiniteNumber(vertex.position[2])
                    ] as [number, number, number]
                };
            })
            .filter((vertex): vertex is MeshInput['vertices'][number] => vertex !== null),
        facets: facets
            .map((facet) => {
                if (!isRecord(facet) || !Array.isArray(facet.vertices) || facet.vertices.length < 3) {
                    return null;
                }

                return {
                    vertices: [
                        toFiniteNumber(facet.vertices[0]),
                        toFiniteNumber(facet.vertices[1]),
                        toFiniteNumber(facet.vertices[2])
                    ] as [number, number, number]
                };
            })
            .filter((facet): facet is MeshFacet => facet !== null)
    };
};

const computeNormals = (positions: Float32Array, indices: Uint32Array): Float32Array => {
    const normals = new Float32Array(positions.length);

    for (let index = 0; index < indices.length; index += 3) {
        const ia = indices[index] * 3;
        const ib = indices[index + 1] * 3;
        const ic = indices[index + 2] * 3;

        const ax = positions[ia];
        const ay = positions[ia + 1];
        const az = positions[ia + 2];
        const bx = positions[ib];
        const by = positions[ib + 1];
        const bz = positions[ib + 2];
        const cx = positions[ic];
        const cy = positions[ic + 1];
        const cz = positions[ic + 2];

        const abx = bx - ax;
        const aby = by - ay;
        const abz = bz - az;
        const acx = cx - ax;
        const acy = cy - ay;
        const acz = cz - az;

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        normals[ia] += nx;
        normals[ia + 1] += ny;
        normals[ia + 2] += nz;
        normals[ib] += nx;
        normals[ib + 1] += ny;
        normals[ib + 2] += nz;
        normals[ic] += nx;
        normals[ic + 1] += ny;
        normals[ic + 2] += nz;
    }

    for (let index = 0; index < normals.length; index += 3) {
        const nx = normals[index];
        const ny = normals[index + 1];
        const nz = normals[index + 2];
        const length = Math.hypot(nx, ny, nz) || 1;
        normals[index] = nx / length;
        normals[index + 1] = ny / length;
        normals[index + 2] = nz / length;
    }

    return normals;
};

const resolveMaterial = (material: ExportMaterial | undefined, doubleSided?: boolean): ExportMaterial & { doubleSided?: boolean } => {
    return {
        baseColor: material?.baseColor || [0.8, 0.8, 0.85, 1],
        metallic: material?.metallic ?? 0.05,
        roughness: material?.roughness ?? 0.9,
        emissive: material?.emissive || [0, 0, 0],
        doubleSided: doubleSided ?? true
    };
};

const extractChartData = (decodedPayload: Record<string, unknown>, options: ChartExportOptions): ChartPoint[] => {
    const xAxis = getNestedValue(decodedPayload, options.xAxisKey);
    const yAxis = getNestedValue(decodedPayload, options.yAxisKey);

    if (Array.isArray(xAxis) && Array.isArray(yAxis)) {
        return xAxis.map((x, index) => ({
            x,
            y: toFiniteNumber(yAxis[index])
        }));
    }

    if (Array.isArray(decodedPayload)) {
        return decodedPayload
            .map((entry) => {
                if (!isRecord(entry)) {
                    return null;
                }

                return {
                    x: entry[options.xAxisKey],
                    y: toFiniteNumber(entry[options.yAxisKey])
                };
            })
            .filter((entry): entry is ChartPoint => entry !== null);
    }

    return [];
};

const resolveChartType = (chartType: ChartExportOptions['chartType']): 'line' | 'bar' | 'scatter' => {
    if (chartType === 'area') {
        return 'line';
    }

    return chartType;
};

const buildChartDataset = (
    chartData: ChartPoint[],
    chartType: 'line' | 'bar' | 'scatter',
    options: ChartExportOptions
): Record<string, unknown> => {
    return {
        label: options.title || 'Data',
        data: chartType === 'scatter'
            ? chartData.map((point) => ({ x: point.x, y: point.y }))
            : chartData.map((point) => point.y),
        borderColor: options.lineColor || '#3b82f6',
        backgroundColor: options.fillColor || 'rgba(59, 130, 246, 0.3)',
        fill: options.chartType === 'area',
        tension: 0.1,
        pointRadius: chartType === 'scatter' ? 4 : 2,
        borderWidth: 2
    };
};

export interface ExportNodeProcessorService {
    process(input: ExportExecutionInput): Promise<void>;
};

export const createExportNodeProcessorService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader
): ExportNodeProcessorService => {
    const exportAtomistic = async (decodedPayload: Record<string, unknown>, objectPath: string): Promise<void> => {
        const exportData = getNestedValue(decodedPayload, 'export.AtomisticExporter');
        if (!isRecord(exportData)) {
            throw new Error('Atomistic export data missing from exposure payload');
        }

        const atomsByType = normalizeAtomsByType(exportData);
        const { positions, colors, min, max } = buildPointCloudData(atomsByType);
        const buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(positions, colors, min, max);

        await minioService.putObject({
            bucket: ObjectBucketName.Models,
            objectKey: objectPath,
            body: buffer,
            metadata: {
                'Content-Type': 'model/gltf-binary'
            }
        });
    };

    const exportMesh = async (decodedPayload: Record<string, unknown>, objectPath: string, options: MeshExportOptions): Promise<void> => {
        const exportData = getNestedValue(decodedPayload, 'export.MeshExporter');
        if (!isRecord(exportData)) {
            throw new Error('Mesh export data missing from exposure payload');
        }

        const mesh = normalizeMesh(exportData);
        const material = resolveMaterial(options.material, options.enableDoubleSided);
        const processed = processMesh(mesh, options.smoothIterations);
        const buffer = nativeModuleLoader.getExporterModule().generateMeshGLB(
            processed.positions,
            processed.normals,
            processed.indices,
            false,
            undefined,
            processed.bounds,
            material
        );

        await minioService.putObject({
            bucket: ObjectBucketName.Models,
            objectKey: objectPath,
            body: buffer,
            metadata: {
                'Content-Type': 'model/gltf-binary'
            }
        });
    };

    const processMesh = (mesh: MeshInput, smoothIterations?: number): {
        positions: Float32Array;
        normals: Float32Array;
        indices: Uint32Array;
        bounds: {
            minX: number;
            minY: number;
            minZ: number;
            maxX: number;
            maxY: number;
            maxZ: number;
        };
    } => {
        if (mesh.vertices.length === 0 || mesh.facets.length === 0) {
            throw new Error('Mesh export requires vertices and facets');
        }

        const vertexMap = new Map<number, [number, number, number]>();
        for (const vertex of mesh.vertices) {
            vertexMap.set(vertex.index, vertex.position);
        }

        const positions = new Float32Array(mesh.vertices.length * 3);
        const bounds = {
            minX: Infinity,
            minY: Infinity,
            minZ: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
            maxZ: -Infinity
        };

        mesh.vertices.forEach((vertex, index) => {
            const base = index * 3;
            positions[base] = vertex.position[0];
            positions[base + 1] = vertex.position[1];
            positions[base + 2] = vertex.position[2];
            bounds.minX = Math.min(bounds.minX, vertex.position[0]);
            bounds.minY = Math.min(bounds.minY, vertex.position[1]);
            bounds.minZ = Math.min(bounds.minZ, vertex.position[2]);
            bounds.maxX = Math.max(bounds.maxX, vertex.position[0]);
            bounds.maxY = Math.max(bounds.maxY, vertex.position[1]);
            bounds.maxZ = Math.max(bounds.maxZ, vertex.position[2]);
        });

        const vertexIndices = new Map<number, number>();
        mesh.vertices.forEach((vertex, index) => {
            vertexIndices.set(vertex.index, index);
        });

        const indices = new Uint32Array(mesh.facets.length * 3);
        mesh.facets.forEach((facet, index) => {
            const base = index * 3;
            indices[base] = vertexIndices.get(facet.vertices[0]) ?? 0;
            indices[base + 1] = vertexIndices.get(facet.vertices[1]) ?? 0;
            indices[base + 2] = vertexIndices.get(facet.vertices[2]) ?? 0;
        });

        if (smoothIterations && smoothIterations > 0) {
            nativeModuleLoader.getExporterModule().taubinSmooth(positions, indices, smoothIterations);
        }

        const normals = computeNormals(positions, indices);
        return { positions, normals, indices, bounds };
    };

    const exportDislocation = async (decodedPayload: Record<string, unknown>, objectPath: string, options: DislocationExportOptions): Promise<void> => {
        const exportData = getNestedValue(decodedPayload, 'export.DislocationExporter');
        if (!isRecord(exportData)) {
            throw new Error('Dislocation export data missing from exposure payload');
        }

        const atomsByType = normalizeDislocationAsAtoms(exportData, options.typeColors, options.colorByType);
        const { positions, colors, min, max } = buildPointCloudData(atomsByType);
        const buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(positions, colors, min, max);

        await minioService.putObject({
            bucket: ObjectBucketName.Models,
            objectKey: objectPath,
            body: buffer,
            metadata: {
                'Content-Type': 'model/gltf-binary'
            }
        });
    };

    const exportChart = async (decodedPayload: Record<string, unknown>, objectPath: string, options: ChartExportOptions): Promise<void> => {
        const width = options.width || 1200;
        const height = options.height || 800;
        const chartCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: options.backgroundColor || '#1a1a2e'
        });
        const chartData = extractChartData(decodedPayload, options);
        if (chartData.length === 0) {
            throw new Error('No chart data found for export node');
        }

        const chartType = resolveChartType(options.chartType);
        const dataset = buildChartDataset(chartData, chartType, options);
        const buffer = await chartCanvas.renderToBuffer({
            type: chartType,
            data: {
                labels: chartType === 'scatter' ? undefined : chartData.map((point) => String(point.x)),
                datasets: [dataset]
            },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: {
                        display: options.showLegend ?? true,
                        labels: { color: '#ffffff' }
                    },
                    title: {
                        display: Boolean(options.title),
                        text: options.title || '',
                        color: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: Boolean(options.xAxisLabel),
                            text: options.xAxisLabel || '',
                            color: '#ffffff'
                        },
                        grid: {
                            display: options.showGrid ?? true,
                            color: 'rgba(255,255,255,0.1)'
                        },
                        ticks: { color: '#cccccc' }
                    },
                    y: {
                        title: {
                            display: Boolean(options.yAxisLabel),
                            text: options.yAxisLabel || '',
                            color: '#ffffff'
                        },
                        grid: {
                            display: options.showGrid ?? true,
                            color: 'rgba(255,255,255,0.1)'
                        },
                        ticks: { color: '#cccccc' }
                    }
                }
            }
        } as never);

        await minioService.putObject({
            bucket: ObjectBucketName.Plugins,
            objectKey: objectPath,
            body: buffer,
            metadata: {
                'Content-Type': 'image/png'
            }
        });
    };

    return {
        async process(input) {
            const exportConfig = input.exposure.export;
            if (!exportConfig) {
                return;
            }

            const exporter = exportConfig.exporter as ExporterName;
            const options = toStringMap(exportConfig.options);
            const objectPath = buildObjectPath(input, exporter, exportConfig.type);

            switch (exporter) {
                case 'AtomisticExporter':
                    await exportAtomistic(input.decodedPayload, objectPath);
                    break;
                case 'MeshExporter':
                    await exportMesh(input.decodedPayload, objectPath, options as MeshExportOptions);
                    break;
                case 'DislocationExporter':
                    await exportDislocation(input.decodedPayload, objectPath, options as DislocationExportOptions);
                    break;
                case 'ChartExporter':
                    await exportChart(input.decodedPayload, objectPath, options as unknown as ChartExportOptions);
                    break;
                default:
                    logger.warn({ exporter }, 'Unsupported export node exporter on daemon');
                    return;
            }

            if (exporter !== 'ChartExporter') {
                await upsertSceneArtifactByObjectName(objectPath, {
                    trajectory: input.executionData.trajectoryId,
                    teamCluster: input.teamClusterId,
                    analysis: input.executionData.analysisId,
                    plugin: input.executionData.pluginId,
                    sourceType: 'plugin-exposure',
                    timestep: input.timestep,
                    objectName: objectPath,
                    storageBucket: ObjectBucketName.Models,
                    params: {
                        exposureId: input.exposure.nodeId
                    },
                    displayName: input.exposure.name,
                    status: 'ready',
                    metadata: {
                        pluginId: input.executionData.pluginId,
                        exposureId: input.exposure.nodeId,
                        exposureName: input.exposure.name,
                        exporter,
                        exportType: exportConfig.type
                    }
                });
            }
        }
    };
};

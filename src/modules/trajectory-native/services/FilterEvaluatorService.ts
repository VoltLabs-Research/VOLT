import { ObjectBucketName } from '@/shared/contracts';
import { DAEMON_PATHS } from '@/core/paths';
import { MinioService } from '@/modules/platform/services';
import {
    NativeModuleLoader,
    type NativeColorModelRequest,
    type NativeConditionFilterPreviewRequest,
    type NativeFilterPreviewRequest,
    type NativeFilterPreviewResponse,
    type NativeParticleFilterModelRequest,
    type NativeSimulationCell,
    type NativeSurfaceAtomsPresetConfig
} from './NativeModuleLoader';
import type { TrajectoryParserService } from './TrajectoryParserService';
import type { TrajectoryPluginParserService } from './TrajectoryPluginParserService';
import { uploadBufferToObjectStore } from '@/shared/storage/uploadBufferToObjectStore';

enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

const HIGHLIGHT_COLOR = [1.0, 0.2, 0.6];
const DEFAULT_COLOR = [0.8, 0.8, 0.8];

const resolveGradientType = (gradientName: string): GradientType => {
    if (gradientName === 'Plasma') {
        return GradientType.Plasma;
    }

    if (gradientName === 'BlueRed') {
        return GradientType.BlueRed;
    }

    if (gradientName === 'GrayScale') {
        return GradientType.Grayscale;
    }

    return GradientType.Viridis;
};

const evaluateFilter = (values: Float32Array, operator: string, compareValue: number): { mask: Uint8Array; matchCount: number; } => {
    const mask = new Uint8Array(values.length);
    let matchCount = 0;

    for (let index = 0; index < values.length; index++) {
        const value = values[index];

        if (!Number.isFinite(value)) {
            continue;
        }

        let matches = false;

        if (operator === '==') {
            matches = value === compareValue;
        } else if (operator === '!=') {
            matches = value !== compareValue;
        } else if (operator === '>') {
            matches = value > compareValue;
        } else if (operator === '>=') {
            matches = value >= compareValue;
        } else if (operator === '<') {
            matches = value < compareValue;
        } else if (operator === '<=') {
            matches = value <= compareValue;
        }

        if (matches) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return {
        mask,
        matchCount
    };
};

const filterByMask = (positions: Float32Array, types: Uint16Array, mask: Uint8Array): {
    positions: Float32Array;
    types: Uint16Array;
    count: number;
} => {
    let count = 0;
    for (let index = 0; index < mask.length; index++) {
        if (mask[index]) {
            count++;
        }
    }

    const filteredPositions = new Float32Array(count * 3);
    const filteredTypes = new Uint16Array(count);
    let cursor = 0;

    for (let index = 0; index < mask.length; index++) {
        if (!mask[index]) {
            continue;
        }

        const sourceIndex = index * 3;
        const targetIndex = cursor * 3;
        filteredPositions[targetIndex] = positions[sourceIndex];
        filteredPositions[targetIndex + 1] = positions[sourceIndex + 1];
        filteredPositions[targetIndex + 2] = positions[sourceIndex + 2];
        filteredTypes[cursor] = types[index];
        cursor++;
    }

    return {
        positions: filteredPositions,
        types: filteredTypes,
        count
    };
};

/**
 * Raised when a `delete` particle-filter action removes all atoms from the
 * trajectory, leaving an empty particle set that cannot produce a valid GLB.
 *
 * Callers should treat this as a domain/validation error (4xx) rather than
 * an infrastructure failure.
 */
export class EmptyFilterResultError extends Error {
    readonly code = 'EMPTY_FILTER_RESULT';

    constructor(totalAtoms: number) {
        super(
            `Particle filter deleted all ${totalAtoms} atom(s); the resulting model would be empty. ` +
            'Adjust the filter mask so that at least one atom is retained.'
        );
        this.name = 'EmptyFilterResultError';
    }
};

const resolveModifierValues = async (
    input: Pick<NativeConditionFilterPreviewRequest, 'analysisId' | 'exposureId' | 'trajectoryId' | 'timestep' | 'property'>,
    trajectoryPluginParserService: TrajectoryPluginParserService
): Promise<Float32Array | undefined> => {
    if (!input.analysisId || !input.exposureId) {
        return undefined;
    }

    const values = await trajectoryPluginParserService.getModifierValues({
        trajectoryId: input.trajectoryId,
        analysisId: input.analysisId,
        exposureId: input.exposureId,
        timestep: input.timestep,
        property: input.property
    });

    if (!values) {
        throw new Error(
            `Modifier property "${input.property}" is unavailable for exposure "${input.exposureId}" at timestep ${input.timestep}`
        );
    }

    return values;
};

const buildCellMatrix = (simulationCell: NativeSimulationCell): [
    number, number, number,
    number, number, number,
    number, number, number
] => {
    const [v0, v1, v2] = simulationCell.geometry.cell_vectors;

    return [
        v0[0], v1[0], v2[0],
        v0[1], v1[1], v2[1],
        v0[2], v1[2], v2[2]
    ];
};

const invertMatrix3x3 = (
    matrix: [
        number, number, number,
        number, number, number,
        number, number, number
    ]
): [
    number, number, number,
    number, number, number,
    number, number, number
] => {
    const [
        m00, m01, m02,
        m10, m11, m12,
        m20, m21, m22
    ] = matrix;

    const cofactor00 = m11 * m22 - m12 * m21;
    const cofactor01 = -(m10 * m22 - m12 * m20);
    const cofactor02 = m10 * m21 - m11 * m20;
    const cofactor10 = -(m01 * m22 - m02 * m21);
    const cofactor11 = m00 * m22 - m02 * m20;
    const cofactor12 = -(m00 * m21 - m01 * m20);
    const cofactor20 = m01 * m12 - m02 * m11;
    const cofactor21 = -(m00 * m12 - m02 * m10);
    const cofactor22 = m00 * m11 - m01 * m10;
    const determinant = m00 * cofactor00 + m01 * cofactor01 + m02 * cofactor02;

    if (Math.abs(determinant) < 1e-12) {
        throw new Error('Simulation cell matrix is singular');
    }

    const inverseDeterminant = 1 / determinant;

    return [
        cofactor00 * inverseDeterminant,
        cofactor10 * inverseDeterminant,
        cofactor20 * inverseDeterminant,
        cofactor01 * inverseDeterminant,
        cofactor11 * inverseDeterminant,
        cofactor21 * inverseDeterminant,
        cofactor02 * inverseDeterminant,
        cofactor12 * inverseDeterminant,
        cofactor22 * inverseDeterminant
    ];
};

const multiplyMatrixVector = (
    matrix: [
        number, number, number,
        number, number, number,
        number, number, number
    ],
    x: number,
    y: number,
    z: number
): [number, number, number] => {
    return [
        matrix[0] * x + matrix[1] * y + matrix[2] * z,
        matrix[3] * x + matrix[4] * y + matrix[5] * z,
        matrix[6] * x + matrix[7] * y + matrix[8] * z
    ];
};

const collectAliveIndices = (aliveMask: Uint8Array): number[] => {
    const aliveIndices: number[] = [];

    for (let index = 0; index < aliveMask.length; index++) {
        if (aliveMask[index] === 1) {
            aliveIndices.push(index);
        }
    }

    return aliveIndices;
};

const buildFractionalCoordinates = (
    positions: Float32Array,
    simulationCell: NativeSimulationCell
): Float32Array => {
    const origin = simulationCell.geometry.cell_origin;
    const inverseMatrix = invertMatrix3x3(buildCellMatrix(simulationCell));
    const fractionalCoordinates = new Float32Array(positions.length);

    for (let index = 0; index < positions.length; index += 3) {
        const [fractionalX, fractionalY, fractionalZ] = multiplyMatrixVector(
            inverseMatrix,
            positions[index] - origin[0],
            positions[index + 1] - origin[1],
            positions[index + 2] - origin[2]
        );

        fractionalCoordinates[index] = fractionalX;
        fractionalCoordinates[index + 1] = fractionalY;
        fractionalCoordinates[index + 2] = fractionalZ;
    }

    return fractionalCoordinates;
};

const createSpatialKey = (x: number, y: number, z: number): string => {
    return `${x},${y},${z}`;
};

const computeVectorLength = (vector: number[]): number => {
    return Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2);
};

const computeVolume = (simulationCell: NativeSimulationCell): number => {
    const matrix = buildCellMatrix(simulationCell);
    const determinant = matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7])
        - matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6])
        + matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]);

    return Math.abs(determinant);
};

const resolveBinCounts = (
    simulationCell: NativeSimulationCell,
    cutoffRadius: number
): [number, number, number] => {
    const vectorLengths = simulationCell.geometry.cell_vectors.map(computeVectorLength);

    return [
        Math.max(1, Math.floor(vectorLengths[0] / cutoffRadius)),
        Math.max(1, Math.floor(vectorLengths[1] / cutoffRadius)),
        Math.max(1, Math.floor(vectorLengths[2] / cutoffRadius))
    ];
};

const clampFractionalComponent = (value: number, isPeriodic: boolean): number => {
    if (isPeriodic) {
        return value - Math.floor(value);
    }

    if (value < 0) {
        return 0;
    }

    if (value >= 1) {
        return 1 - Number.EPSILON;
    }

    return value;
};

const resolveCellIndex = (value: number, bins: number, isPeriodic: boolean): number => {
    const normalizedValue = clampFractionalComponent(value, isPeriodic);
    const index = Math.floor(normalizedValue * bins);

    if (index < 0) {
        return 0;
    }

    if (index >= bins) {
        return bins - 1;
    }

    return index;
};

const resolveMinimumImageDelta = (
    fractionalCoordinates: Float32Array,
    leftIndex: number,
    rightIndex: number,
    simulationCell: NativeSimulationCell,
    cellMatrix: ReturnType<typeof buildCellMatrix>
): [number, number, number] => {
    const leftOffset = leftIndex * 3;
    const rightOffset = rightIndex * 3;
    let deltaFractionalX = fractionalCoordinates[rightOffset] - fractionalCoordinates[leftOffset];
    let deltaFractionalY = fractionalCoordinates[rightOffset + 1] - fractionalCoordinates[leftOffset + 1];
    let deltaFractionalZ = fractionalCoordinates[rightOffset + 2] - fractionalCoordinates[leftOffset + 2];
    const periodicBoundaryConditions = simulationCell.geometry.periodic_boundary_conditions;

    if (periodicBoundaryConditions.x) {
        deltaFractionalX -= Math.round(deltaFractionalX);
    }

    if (periodicBoundaryConditions.y) {
        deltaFractionalY -= Math.round(deltaFractionalY);
    }

    if (periodicBoundaryConditions.z) {
        deltaFractionalZ -= Math.round(deltaFractionalZ);
    }

    return multiplyMatrixVector(
        cellMatrix,
        deltaFractionalX,
        deltaFractionalY,
        deltaFractionalZ
    );
};

const buildSpatialIndex = (
    fractionalCoordinates: Float32Array,
    aliveIndices: number[],
    simulationCell: NativeSimulationCell,
    binCounts: [number, number, number]
): Map<string, number[]> => {
    const index = new Map<string, number[]>();
    const periodicBoundaryConditions = simulationCell.geometry.periodic_boundary_conditions;

    for (const atomIndex of aliveIndices) {
        const offset = atomIndex * 3;
        const key = createSpatialKey(
            resolveCellIndex(fractionalCoordinates[offset], binCounts[0], periodicBoundaryConditions.x),
            resolveCellIndex(fractionalCoordinates[offset + 1], binCounts[1], periodicBoundaryConditions.y),
            resolveCellIndex(fractionalCoordinates[offset + 2], binCounts[2], periodicBoundaryConditions.z)
        );
        const atomsInCell = index.get(key);

        if (atomsInCell) {
            atomsInCell.push(atomIndex);
            continue;
        }

        index.set(key, [atomIndex]);
    }

    return index;
};

const resolvePercentile = (values: number[], percentile: number): number => {
    if (values.length === 0) {
        return 0;
    }

    const sortedValues = [...values].sort((left, right) => left - right);
    const percentileIndex = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.ceil(sortedValues.length * percentile) - 1)
    );

    return sortedValues[percentileIndex];
};

const estimateAutoCutoffRadius = (
    fractionalCoordinates: Float32Array,
    aliveIndices: number[],
    simulationCell: NativeSimulationCell
): number => {
    if (aliveIndices.length < 2) {
        return 1;
    }

    const sampleSize = Math.min(64, aliveIndices.length);
    const sampleStep = aliveIndices.length / sampleSize;
    const nearestNeighborDistances: number[] = [];
    const cellMatrix = buildCellMatrix(simulationCell);

    for (let sampleIndex = 0; sampleIndex < sampleSize; sampleIndex++) {
        const atomIndex = aliveIndices[Math.min(
            aliveIndices.length - 1,
            Math.floor(sampleIndex * sampleStep)
        )];
        let minimumDistanceSquared = Number.POSITIVE_INFINITY;

        for (const candidateIndex of aliveIndices) {
            if (candidateIndex === atomIndex) {
                continue;
            }

            const [deltaX, deltaY, deltaZ] = resolveMinimumImageDelta(
                fractionalCoordinates,
                atomIndex,
                candidateIndex,
                simulationCell,
                cellMatrix
            );
            const distanceSquared = deltaX ** 2 + deltaY ** 2 + deltaZ ** 2;

            if (distanceSquared > 0 && distanceSquared < minimumDistanceSquared) {
                minimumDistanceSquared = distanceSquared;
            }
        }

        if (Number.isFinite(minimumDistanceSquared)) {
            nearestNeighborDistances.push(Math.sqrt(minimumDistanceSquared));
        }
    }

    if (nearestNeighborDistances.length > 0) {
        return Math.max(resolvePercentile(nearestNeighborDistances, 0.5) * 1.35, 1e-6);
    }

    const volume = computeVolume(simulationCell);
    if (volume <= 0) {
        return 1;
    }

    return Math.max(Math.cbrt(volume / aliveIndices.length) * 1.35, 1e-6);
};

const computeLocalSurfaceStats = (
    fractionalCoordinates: Float32Array,
    types: Uint16Array,
    aliveIndices: number[],
    simulationCell: NativeSimulationCell,
    cutoffRadius: number
): { coordination: Uint16Array; anisotropy: Float32Array; } => {
    const atomCount = types.length;
    const coordination = new Uint16Array(atomCount);
    const anisotropyVectors = new Float32Array(atomCount * 3);
    const anisotropy = new Float32Array(atomCount);
    const cutoffRadiusSquared = cutoffRadius ** 2;
    const periodicBoundaryConditions = simulationCell.geometry.periodic_boundary_conditions;
    const binCounts = resolveBinCounts(simulationCell, cutoffRadius);
    const spatialIndex = buildSpatialIndex(fractionalCoordinates, aliveIndices, simulationCell, binCounts);
    const cellMatrix = buildCellMatrix(simulationCell);

    for (const atomIndex of aliveIndices) {
        const offset = atomIndex * 3;
        const binX = resolveCellIndex(fractionalCoordinates[offset], binCounts[0], periodicBoundaryConditions.x);
        const binY = resolveCellIndex(fractionalCoordinates[offset + 1], binCounts[1], periodicBoundaryConditions.y);
        const binZ = resolveCellIndex(fractionalCoordinates[offset + 2], binCounts[2], periodicBoundaryConditions.z);
        const neighborKeys = new Set<string>();

        for (let deltaX = -1; deltaX <= 1; deltaX++) {
            for (let deltaY = -1; deltaY <= 1; deltaY++) {
                for (let deltaZ = -1; deltaZ <= 1; deltaZ++) {
                    let neighborX = binX + deltaX;
                    let neighborY = binY + deltaY;
                    let neighborZ = binZ + deltaZ;

                    if (periodicBoundaryConditions.x) {
                        neighborX = (neighborX + binCounts[0]) % binCounts[0];
                    } else if (neighborX < 0 || neighborX >= binCounts[0]) {
                        continue;
                    }

                    if (periodicBoundaryConditions.y) {
                        neighborY = (neighborY + binCounts[1]) % binCounts[1];
                    } else if (neighborY < 0 || neighborY >= binCounts[1]) {
                        continue;
                    }

                    if (periodicBoundaryConditions.z) {
                        neighborZ = (neighborZ + binCounts[2]) % binCounts[2];
                    } else if (neighborZ < 0 || neighborZ >= binCounts[2]) {
                        continue;
                    }

                    neighborKeys.add(createSpatialKey(neighborX, neighborY, neighborZ));
                }
            }
        }

        for (const neighborKey of neighborKeys) {
            const candidateIndices = spatialIndex.get(neighborKey) || [];

            for (const candidateIndex of candidateIndices) {
                if (candidateIndex <= atomIndex) {
                    continue;
                }

                const [deltaX, deltaY, deltaZ] = resolveMinimumImageDelta(
                    fractionalCoordinates,
                    atomIndex,
                    candidateIndex,
                    simulationCell,
                    cellMatrix
                );
                const distanceSquared = deltaX ** 2 + deltaY ** 2 + deltaZ ** 2;

                if (distanceSquared === 0 || distanceSquared > cutoffRadiusSquared) {
                    continue;
                }

                const distance = Math.sqrt(distanceSquared);
                const normalX = deltaX / distance;
                const normalY = deltaY / distance;
                const normalZ = deltaZ / distance;
                const atomVectorOffset = atomIndex * 3;
                const candidateVectorOffset = candidateIndex * 3;

                coordination[atomIndex] += 1;
                coordination[candidateIndex] += 1;
                anisotropyVectors[atomVectorOffset] += normalX;
                anisotropyVectors[atomVectorOffset + 1] += normalY;
                anisotropyVectors[atomVectorOffset + 2] += normalZ;
                anisotropyVectors[candidateVectorOffset] -= normalX;
                anisotropyVectors[candidateVectorOffset + 1] -= normalY;
                anisotropyVectors[candidateVectorOffset + 2] -= normalZ;
            }
        }
    }

    for (const atomIndex of aliveIndices) {
        if (coordination[atomIndex] === 0) {
            anisotropy[atomIndex] = 1;
            continue;
        }

        const vectorOffset = atomIndex * 3;
        const vectorNorm = Math.sqrt(
            anisotropyVectors[vectorOffset] ** 2
            + anisotropyVectors[vectorOffset + 1] ** 2
            + anisotropyVectors[vectorOffset + 2] ** 2
        );

        anisotropy[atomIndex] = vectorNorm / coordination[atomIndex];
    }

    return {
        coordination,
        anisotropy
    };
};

const estimateBulkCoordination = (
    coordination: Uint16Array,
    types: Uint16Array,
    aliveIndices: number[],
    byType: boolean
): { global: number; byType: Map<number, number>; } => {
    const globalValues = aliveIndices.map((atomIndex) => coordination[atomIndex]);
    const globalBulk = resolvePercentile(globalValues, 0.9);
    const byTypeBulk = new Map<number, number>();

    if (!byType) {
        return {
            global: globalBulk,
            byType: byTypeBulk
        };
    }

    const coordinationByType = new Map<number, number[]>();

    for (const atomIndex of aliveIndices) {
        const atomType = types[atomIndex];
        const values = coordinationByType.get(atomType);

        if (values) {
            values.push(coordination[atomIndex]);
            continue;
        }

        coordinationByType.set(atomType, [coordination[atomIndex]]);
    }

    for (const [atomType, values] of coordinationByType.entries()) {
        byTypeBulk.set(atomType, resolvePercentile(values, 0.9));
    }

    return {
        global: globalBulk,
        byType: byTypeBulk
    };
};

const resolveSurfaceAnisotropyScale = (
    anisotropy: Float32Array,
    aliveIndices: number[]
): number => {
    const values: number[] = [];

    for (const atomIndex of aliveIndices) {
        const value = anisotropy[atomIndex];
        if (!Number.isFinite(value)) {
            continue;
        }

        values.push(value);
    }

    if (values.length === 0) {
        return 1;
    }

    // The preset UI exposes anisotropy as a 0..1 control. Map that slider to a
    // frame-local scale so the threshold stays meaningful across materials and
    // cutoffs instead of assuming an absolute anisotropy magnitude.
    return Math.max(resolvePercentile(values, 0.95), 1e-6);
};

const evaluateSurfaceAtomsPreset = (
    positions: Float32Array,
    types: Uint16Array,
    simulationCell: NativeSimulationCell,
    presetConfig: NativeSurfaceAtomsPresetConfig
): { mask: Uint8Array; matchCount: number; } => {
    const atomCount = types.length;
    const surfaceMask = new Uint8Array(atomCount);
    const aliveMask = new Uint8Array(atomCount);
    const fractionalCoordinates = buildFractionalCoordinates(positions, simulationCell);

    aliveMask.fill(1);

    let cutoffRadius = presetConfig.cutoffRadius;
    if (cutoffRadius === undefined || presetConfig.cutoffMode === 'auto') {
        cutoffRadius = estimateAutoCutoffRadius(
            fractionalCoordinates,
            collectAliveIndices(aliveMask),
            simulationCell
        );
    }
    cutoffRadius = Math.max(cutoffRadius, 1e-6);

    for (let layer = 0; layer < presetConfig.layers; layer++) {
        const aliveIndices = collectAliveIndices(aliveMask);
        if (aliveIndices.length === 0) {
            break;
        }

        const localStats = computeLocalSurfaceStats(
            fractionalCoordinates,
            types,
            aliveIndices,
            simulationCell,
            cutoffRadius
        );
        const bulkCoordination = estimateBulkCoordination(
            localStats.coordination,
            types,
            aliveIndices,
            presetConfig.byType
        );
        const effectiveAnisotropyThreshold = presetConfig.anisotropyThreshold
            * resolveSurfaceAnisotropyScale(localStats.anisotropy, aliveIndices);
        let layerMatches = 0;

        for (const atomIndex of aliveIndices) {
            const bulkValue = presetConfig.byType
                ? (bulkCoordination.byType.get(types[atomIndex]) ?? bulkCoordination.global)
                : bulkCoordination.global;
            const coordinationDeficit = bulkValue - localStats.coordination[atomIndex];
            const isSurfaceAtom = coordinationDeficit >= presetConfig.coordinationDeficit
                && localStats.anisotropy[atomIndex] >= effectiveAnisotropyThreshold;

            if (!isSurfaceAtom) {
                continue;
            }

            surfaceMask[atomIndex] = 1;
            aliveMask[atomIndex] = 0;
            layerMatches++;
        }

        if (layerMatches === 0) {
            break;
        }
    }

    let matchCount = 0;
    for (let index = 0; index < surfaceMask.length; index++) {
        if (surfaceMask[index] === 1) {
            matchCount++;
        }
    }

    return {
        mask: surfaceMask,
        matchCount
    };
};

export interface FilterEvaluatorService {
    previewFilter(input: NativeFilterPreviewRequest): Promise<NativeFilterPreviewResponse>;
    exportColoredModel(input: NativeColorModelRequest): Promise<{ objectKey: string; }>;
    exportParticleFilterModel(input: NativeParticleFilterModelRequest): Promise<{ objectKey: string; atomsResult: number; }>;
};

export const createFilterEvaluatorService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    trajectoryParserService: TrajectoryParserService,
    trajectoryPluginParserService: TrajectoryPluginParserService
): FilterEvaluatorService => ({
    async previewFilter(input) {
        return trajectoryParserService.withDumpFile(input, async (dumpPath) => {
            if (input.kind === 'preset') {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath);
                const presetResult = evaluateSurfaceAtomsPreset(
                    parsed.positions,
                    parsed.types,
                    input.simulationCell,
                    input.presetConfig
                );

                return {
                    maskBase64: Buffer.from(presetResult.mask).toString('base64'),
                    matchCount: presetResult.matchCount,
                    totalAtoms: presetResult.mask.length
                };
            }

            let values: Float32Array;
            const externalValues = input.externalValuesBase64
                ? trajectoryParserService.decodeFloat32Array(input.externalValuesBase64)
                : await resolveModifierValues(input, trajectoryPluginParserService);

            if (externalValues) {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath, {
                    includeIds: true,
                    properties: []
                });
                values = trajectoryParserService.remapExternalValues(parsed, externalValues);
            } else {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath, {
                    includeIds: input.property.toLowerCase() === 'id',
                    properties: ['type', 'x', 'y', 'z', 'id'].includes(input.property.toLowerCase())
                        ? []
                        : [input.property]
                });
                values = trajectoryParserService.getPropertyValues(parsed, input.property);
            }

            const filterResult = evaluateFilter(values, input.operator, input.value);
            return {
                maskBase64: Buffer.from(filterResult.mask).toString('base64'),
                matchCount: filterResult.matchCount,
                totalAtoms: filterResult.mask.length
            };
        });
    },

    async exportColoredModel(input) {
        await trajectoryParserService.withDumpFile({ trajectoryId: input.trajectoryId, timestep: input.timestep }, async (dumpPath) => {
            let buffer: Buffer;
            const externalValues = input.externalValuesBase64
                ? trajectoryParserService.decodeFloat32Array(input.externalValuesBase64)
                : await resolveModifierValues(input, trajectoryPluginParserService);

            {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath, externalValues
                    ? {
                        includeIds: true,
                        properties: []
                    }
                    : {
                        properties: [input.property]
                    });

                const values = externalValues
                    ? trajectoryParserService.remapExternalValues(parsed, externalValues)
                    : trajectoryParserService.getPropertyValues(parsed, input.property);
                if (values.length === 0) {
                    throw new Error(`Property '${input.property}' not found in trajectory dump`);
                }

                const colors = nativeModuleLoader.getExporterModule().applyPropertyColors(
                    values,
                    input.startValue,
                    input.endValue,
                    resolveGradientType(input.gradient)
                );
                buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(
                    parsed.positions,
                    colors,
                    parsed.min,
                    parsed.max
                );
            }
            // parsed, values, colors now out of scope — eligible for GC

            await uploadBufferToObjectStore({
                objectStore: minioService,
                bucket: ObjectBucketName.Models,
                objectKey: input.objectKey,
                buffer,
                contentType: 'model/gltf-binary',
                tempDirectory: DAEMON_PATHS.analysisOutput,
                tempFilePrefix: 'volt-filter-export',
                tempFileSuffix: '.glb'
            });
        });

        return {
            objectKey: input.objectKey
        };
    },

    async exportParticleFilterModel(input) {
        return trajectoryParserService.withDumpFile({ trajectoryId: input.trajectoryId, timestep: input.timestep }, async (dumpPath) => {
            let buffer: Buffer;
            let atomsResult = 0;

            {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath);
                const mask = trajectoryParserService.decodeUint8Array(input.maskBase64);

                if (input.action === 'delete') {
                    const inverseMask = new Uint8Array(mask.length);
                    for (let index = 0; index < mask.length; index++) {
                        inverseMask[index] = mask[index] ? 0 : 1;
                    }

                    const filtered = filterByMask(parsed.positions, parsed.types, inverseMask);
                    if (filtered.count === 0) {
                        throw new EmptyFilterResultError(mask.length);
                    }

                    buffer = nativeModuleLoader.getExporterModule().generateGLB(
                        filtered.positions,
                        filtered.types,
                        parsed.min,
                        parsed.max
                    );
                    atomsResult = filtered.count;
                } else {
                    const atomCount = parsed.positions.length / 3;
                    const colors = new Float32Array(atomCount * 3);

                    for (let index = 0; index < atomCount; index++) {
                        const color = mask[index] === 1 ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
                        colors[index * 3] = color[0];
                        colors[index * 3 + 1] = color[1];
                        colors[index * 3 + 2] = color[2];
                        if (mask[index] === 1) {
                            atomsResult++;
                        }
                    }

                    buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(
                        parsed.positions,
                        colors,
                        parsed.min,
                        parsed.max
                    );
                }
            }
            // parsed, mask, colors, filtered now out of scope — eligible for GC

            await uploadBufferToObjectStore({
                objectStore: minioService,
                bucket: ObjectBucketName.Models,
                objectKey: input.objectKey,
                buffer,
                contentType: 'model/gltf-binary',
                tempDirectory: DAEMON_PATHS.analysisOutput,
                tempFilePrefix: 'volt-filter-export',
                tempFileSuffix: '.glb'
            });

            return {
                objectKey: input.objectKey,
                atomsResult
            };
        });
    }
});

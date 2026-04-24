import { Service } from '@/core/decorators/service';
import { normalizePagination, calculatePaginationOffset } from '@/contracts/pagination';
import type { VtrFrameCache } from '@/modules/trajectory/application/vtr/VtrFrameCache';
import type { VtrReaderRegistry } from '@/modules/trajectory/application/vtr/VtrReaderRegistry';
import type { VtrFrameData } from '@/modules/trajectory/infrastructure/codecs/vtr-reader';
import type { ParsedSimulationCell } from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';
import { isObjectNotFoundError } from '@/core/storage/contracts/cluster-object-store';

export interface ParsedTrajectoryMetadata {
    headers: string[];
    simulationCell: ParsedSimulationCell;
}

export interface ParsedTrajectory {
    metadata: ParsedTrajectoryMetadata;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
    min: [number, number, number];
    max: [number, number, number];
}

export interface DumpFileInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey?: string;
}

export interface PropertyStatsInput extends DumpFileInput {
    property: string;
}

export interface UniqueValuesInput extends PropertyStatsInput {
    maxValues: number;
}

export interface AtomsPageInput extends DumpFileInput {
    page: number;
    limit: number;
}

export interface AtomsPageRow {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number;
}

export interface AtomsPageResult {
    atoms: AtomsPageRow[];
    totalAtoms: number;
    nativeProperties: string[];
}

const buildSimulationCell = (frame: VtrFrameData): ParsedSimulationCell => {
    const width = frame.frameBbox[3] - frame.frameBbox[0];
    const length = frame.frameBbox[4] - frame.frameBbox[1];
    const height = frame.frameBbox[5] - frame.frameBbox[2];
    return {
        boundingBox: { width, length, height },
        geometry: {
            cell_vectors: [[width, 0, 0], [0, length, 0], [0, 0, height]],
            cell_origin: [frame.frameBbox[0], frame.frameBbox[1], frame.frameBbox[2]],
            periodic_boundary_conditions: { x: true, y: true, z: true }
        }
    };
};

const frameToParsedTrajectory = (frame: VtrFrameData): ParsedTrajectory => {
    const min: [number, number, number] = [frame.frameBbox[0], frame.frameBbox[1], frame.frameBbox[2]];
    const max: [number, number, number] = [frame.frameBbox[3], frame.frameBbox[4], frame.frameBbox[5]];
    const propertyHeaders = Object.keys(frame.properties);
    return {
        metadata: {
            headers: ['id', 'type', 'x', 'y', 'z', ...propertyHeaders],
            simulationCell: buildSimulationCell(frame)
        },
        positions: frame.positions,
        types: frame.types,
        ids: frame.ids,
        properties: frame.properties,
        min,
        max
    };
};

const computeStats = (values: Float32Array): { min: number; max: number } => {
    if (values.length === 0) return { min: 0, max: 0 };
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        if (!Number.isFinite(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 };
    return { min, max };
};

const collectUnique = (values: Float32Array, maxValues: number): number[] => {
    const unique = new Set<number>();
    for (let index = 0; index < values.length && unique.size < maxValues; index++) {
        const value = values[index];
        if (Number.isFinite(value)) unique.add(value);
    }
    return [...unique].sort((a, b) => a - b);
};

@Service('trajectoryParser')
export class TrajectoryParser {
    constructor(
        private readonly vtrReaderRegistry: VtrReaderRegistry,
        private readonly vtrFrameCache: VtrFrameCache
    ) {}

    public async readFrame(input: DumpFileInput): Promise<ParsedTrajectory> {
        const cached = this.vtrFrameCache.get(input.trajectoryId, input.timestep);
        if (cached) return frameToParsedTrajectory(cached);

        try {
            const reader = await this.vtrReaderRegistry.openReader({
                trajectoryId: input.trajectoryId,
                ownerClusterId: input.ownerClusterId
            });
            const frame = await reader.readFrame(input.timestep);
            this.vtrFrameCache.put(input.trajectoryId, input.timestep, frame);
            return frameToParsedTrajectory(frame);
        } catch (error) {
            throw this.rethrowNotFound(error, input);
        }
    }

    public async getTrajectoryMetadata(input: DumpFileInput): Promise<ParsedTrajectoryMetadata> {
        const parsed = await this.readFrame(input);
        return parsed.metadata;
    }

    public async getPropertyStats(input: PropertyStatsInput): Promise<{ min: number; max: number }> {
        const parsed = await this.readFrame(input);
        const values = this.getPropertyValues(parsed, input.property);
        return computeStats(values);
    }

    public async getUniqueValues(input: UniqueValuesInput): Promise<number[]> {
        const parsed = await this.readFrame(input);
        const values = this.getPropertyValues(parsed, input.property);
        if (values.length === 0) return [];
        return collectUnique(values, input.maxValues);
    }

    public async getAtomsPage(input: AtomsPageInput): Promise<AtomsPageResult> {
        const parsed = await this.readFrame(input);
        const totalAtoms = parsed.ids ? parsed.ids.length : parsed.positions.length / 3;
        const pagination = normalizePagination(input.page, input.limit);
        const startIndex = calculatePaginationOffset(pagination.page, pagination.limit);
        const endIndex = Math.min(totalAtoms, startIndex + pagination.limit);
        const properties = parsed.properties;
        const nativeProperties = properties ? Object.keys(properties) : [];
        const atoms: AtomsPageRow[] = [];

        for (let index = startIndex; index < endIndex; index++) {
            const atom: AtomsPageRow = {
                id: parsed.ids ? parsed.ids[index] : index + 1,
                type: parsed.types[index],
                x: parsed.positions[index * 3],
                y: parsed.positions[index * 3 + 1],
                z: parsed.positions[index * 3 + 2]
            };
            for (const propName of nativeProperties) {
                atom[propName] = properties![propName][index];
            }
            atoms.push(atom);
        }

        return { atoms, totalAtoms, nativeProperties };
    }

    public async getAtomIds(input: DumpFileInput): Promise<number[]> {
        const parsed = await this.readFrame(input);
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for atom-id lookup');
        }
        return Array.from(parsed.ids);
    }

    public getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array {
        const lowerProperty = property.toLowerCase();
        const axisIndex = ({ x: 0, y: 1, z: 2 } as const)[lowerProperty as 'x' | 'y' | 'z'];

        if (lowerProperty === 'type') {
            return new Float32Array(parsed.types);
        }

        if (axisIndex !== undefined) {
            const values = new Float32Array(parsed.positions.length / 3);
            for (let index = 0; index < values.length; index++) {
                values[index] = parsed.positions[index * 3 + axisIndex];
            }
            return values;
        }

        if (lowerProperty === 'id' && parsed.ids) {
            return Float32Array.from(parsed.ids);
        }

        const properties = parsed.properties;
        if (!properties) return new Float32Array(0);

        const source = properties[property] ?? properties[lowerProperty];
        return source ? new Float32Array(source) : new Float32Array(0);
    }

    public remapExternalValues(parsed: ParsedTrajectory, externalValues: Float32Array): Float32Array {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }
        const values = new Float32Array(parsed.ids.length);
        for (let index = 0; index < parsed.ids.length; index++) {
            values[index] = externalValues[parsed.ids[index]];
        }
        return values;
    }

    public getModelObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.glb.zst`;
    }

    private rethrowNotFound(error: unknown, input: DumpFileInput): Error {
        if (isObjectNotFoundError(error)) {
            const notFound = new Error(
                `VTR object not found: trajectoryId=${input.trajectoryId}, timestep=${input.timestep}, ` +
                `ownerClusterId=${input.ownerClusterId}. The trajectory may not have been ingested yet.`
            );
            notFound.name = 'VtrNotFoundError';
            return notFound;
        }
        if (error instanceof Error) return error;
        return new Error(String(error));
    }
}

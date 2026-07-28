import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { normalizePagination, calculatePaginationOffset } from '@shared/contracts/types/pagination';
import type {
    TrajectoryFrameData,
    TrajectoryFrameStore,
    TrajectoryElementMetadata
} from '@modules/trajectory/services/storage/TrajectoryFrameStore';
import type { ParsedSimulationCell } from '@modules/trajectory/services/parsing/TrajectoryParserFactory';
import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import type {
    ColumnDType,
    TypedColumn,
    ElementTableEntry,
    LammpsUnits
} from '@shared/domain/catalog';

export interface ParsedTrajectoryMetadata {
    headers: string[];
    simulationCell: ParsedSimulationCell;
    units: LammpsUnits;
    elementTable: ElementTableEntry[];
}

export interface ParsedTrajectory {
    metadata: ParsedTrajectoryMetadata;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties: Record<string, TypedColumn>;
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
    propertyDtypes: Record<string, ColumnDType>;
    units: LammpsUnits;
    elementTable: ElementTableEntry[];
}

export interface PropertyStatsResult {
    min: number;
    max: number;
    dtype: ColumnDType;
}

export interface UniqueValuesResult {
    values: number[];
    dtype: ColumnDType;
}

const buildSimulationCell = (frame: TrajectoryFrameData): ParsedSimulationCell => {
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

const frameToParsedTrajectory = (
    frame: TrajectoryFrameData,
    elementMetadata: TrajectoryElementMetadata
): ParsedTrajectory => {
    const min: [number, number, number] = [frame.frameBbox[0], frame.frameBbox[1], frame.frameBbox[2]];
    const max: [number, number, number] = [frame.frameBbox[3], frame.frameBbox[4], frame.frameBbox[5]];
    const propertyHeaders = Object.keys(frame.properties);
    return {
        metadata: {
            headers: ['id', 'type', 'x', 'y', 'z', ...propertyHeaders],
            simulationCell: buildSimulationCell(frame),
            units: elementMetadata.units,
            elementTable: elementMetadata.elementTable
        },
        positions: frame.positions,
        types: frame.types,
        ids: frame.ids,
        properties: frame.properties,
        min,
        max
    };
};

const computeStats = (values: Int32Array | Float32Array): { min: number; max: number } => {
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

const collectUnique = (values: Int32Array | Float32Array, maxValues: number): number[] => {
    const unique = new Set<number>();
    for (let index = 0; index < values.length && unique.size < maxValues; index++) {
        const value = values[index];
        if (Number.isFinite(value)) unique.add(value);
    }
    return [...unique].sort((a, b) => a - b);
};

export class TrajectoryParser {
    constructor(private readonly trajectoryFrameStore: TrajectoryFrameStore) {}

    public async readFrame(input: DumpFileInput): Promise<ParsedTrajectory> {
        try {
            const [frame, elementMetadata] = await Promise.all([
                this.trajectoryFrameStore.readFrame({
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    ownerClusterId: input.ownerClusterId
                }),
                this.trajectoryFrameStore.readElementMetadata({
                    trajectoryId: input.trajectoryId,
                    ownerClusterId: input.ownerClusterId
                })
            ]);
            return frameToParsedTrajectory(frame, elementMetadata);
        } catch (error) {
            throw this.rethrowNotFound(error, input);
        }
    }

    public async getTrajectoryMetadata(input: DumpFileInput): Promise<ParsedTrajectoryMetadata> {
        const parsed = await this.readFrame(input);
        return parsed.metadata;
    }

    public async getPropertyStats(input: PropertyStatsInput): Promise<PropertyStatsResult> {
        const parsed = await this.readFrame(input);
        const column = this.getPropertyColumn(parsed, input.property);
        return { ...computeStats(column.values), dtype: column.dtype };
    }

    public async getUniqueValues(input: UniqueValuesInput): Promise<UniqueValuesResult> {
        const parsed = await this.readFrame(input);
        const column = this.getPropertyColumn(parsed, input.property);
        return {
            values: column.values.length === 0 ? [] : collectUnique(column.values, input.maxValues),
            dtype: column.dtype
        };
    }

    public async getAtomsPage(input: AtomsPageInput): Promise<AtomsPageResult> {
        const parsed = await this.readFrame(input);
        const totalAtoms = parsed.ids ? parsed.ids.length : parsed.positions.length / 3;
        const pagination = normalizePagination(input.page, input.limit);
        const startIndex = calculatePaginationOffset(pagination.page, pagination.limit);
        const endIndex = Math.min(totalAtoms, startIndex + pagination.limit);
        const properties = parsed.properties;
        const nativeProperties = Object.keys(properties);
        const propertyDtypes: Record<string, ColumnDType> = {};
        for (const propName of nativeProperties) {
            propertyDtypes[propName] = properties[propName].dtype;
        }
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
                atom[propName] = properties[propName].values[index];
            }
            atoms.push(atom);
        }

        return {
            atoms,
            totalAtoms,
            nativeProperties,
            propertyDtypes,
            units: parsed.metadata.units,
            elementTable: parsed.metadata.elementTable
        };
    }

    public async getAtomIds(input: DumpFileInput): Promise<number[]> {
        const parsed = await this.readFrame(input);
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for atom-id lookup');
        }
        return Array.from(parsed.ids);
    }

    public getPropertyColumn(parsed: ParsedTrajectory, property: string): TypedColumn {
        const lowerProperty = property.toLowerCase();
        const axisIndex = ({ x: 0, y: 1, z: 2 } as const)[lowerProperty as 'x' | 'y' | 'z'];

        if (lowerProperty === 'type') {
            return { dtype: 'i32', values: Int32Array.from(parsed.types) };
        }

        if (axisIndex !== undefined) {
            const values = new Float32Array(parsed.positions.length / 3);
            for (let index = 0; index < values.length; index++) {
                values[index] = parsed.positions[index * 3 + axisIndex];
            }
            return { dtype: 'f32', values };
        }

        if (lowerProperty === 'id' && parsed.ids) {
            return { dtype: 'i32', values: Int32Array.from(parsed.ids) };
        }

        const source = parsed.properties[property] ?? parsed.properties[lowerProperty];
        return source ?? { dtype: 'f32', values: new Float32Array(0) };
    }

    public getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array {
        const column = this.getPropertyColumn(parsed, property);
        return column.values instanceof Float32Array
            ? column.values
            : Float32Array.from(column.values);
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
                `Parquet trajectory object not found: trajectoryId=${input.trajectoryId}, timestep=${input.timestep}, ` +
                `ownerClusterId=${input.ownerClusterId}. The trajectory may not have been ingested yet.`
            );
            notFound.name = 'ParquetTrajectoryNotFoundError';
            return notFound;
        }
        if (error instanceof Error) return error;
        return new Error(String(error));
    }
}

let trajectoryParserInstance: TrajectoryParser | null = null;

export const getTrajectoryParser = (): TrajectoryParser => {
    trajectoryParserInstance ??= new TrajectoryParser(getTrajectoryFrameStore());
    return trajectoryParserInstance;
};

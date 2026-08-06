import { toTrajectoryFrameModelObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { singleton } from '@shared/application/utilities/singleton';
import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { normalizePagination, calculatePaginationOffset } from '@shared/contracts/types/pagination';
import type {
    TrajectoryFrameData,
    TrajectoryFrameLookupInput,
    TrajectoryFrameStore,
    TrajectoryElementMetadata
} from '@shared/contracts/types/trajectory-frame-store';
import type { ParsedSimulationCell } from '@modules/trajectory/services/parsing/TrajectoryParserFactory';
import { toTrajectoryFrameError } from '@modules/trajectory/services/storage/trajectory-not-found-error';
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

export interface ParsedTrajectory extends TrajectoryFrameData {
    metadata: ParsedTrajectoryMetadata;
    min: [number, number, number];
    max: [number, number, number];
}

export interface PropertyStatsInput extends TrajectoryFrameLookupInput {
    property: string;
}

export interface UniqueValuesInput extends PropertyStatsInput {
    maxValues: number;
}

export interface AtomsPageInput extends TrajectoryFrameLookupInput {
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
        boundingBox: {
            width,
            length,
            height
        },
        geometry: {
            cell_vectors: [[width, 0, 0], [0, length, 0], [0, 0, height]],
            cell_origin: [frame.frameBbox[0], frame.frameBbox[1], frame.frameBbox[2]],
            periodic_boundary_conditions: {
                x: true,
                y: true,
                z: true
            }
        }
    };
};

const frameToParsedTrajectory = (
    frame: TrajectoryFrameData,
    elementMetadata: TrajectoryElementMetadata
): ParsedTrajectory => ({
    ...frame,
    metadata: {
        headers: ['id', 'type', 'x', 'y', 'z', ...Object.keys(frame.properties)],
        simulationCell: buildSimulationCell(frame),
        units: elementMetadata.units,
        elementTable: elementMetadata.elementTable
    },
    min: [frame.frameBbox[0], frame.frameBbox[1], frame.frameBbox[2]],
    max: [frame.frameBbox[3], frame.frameBbox[4], frame.frameBbox[5]]
});

const computeStats = (values: Int32Array | Float32Array): { min: number; max: number } => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        if (!Number.isFinite(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return {
        min: 0,
        max: 0
    };
    return {
        min,
        max
    };
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

    public async readFrame(input: TrajectoryFrameLookupInput): Promise<ParsedTrajectory> {
        try {
            const [frame, elementMetadata] = await Promise.all([
                this.trajectoryFrameStore.readFrame(input),
                this.trajectoryFrameStore.readElementMetadata(input)
            ]);
            return frameToParsedTrajectory(frame, elementMetadata);
        } catch (error) {
            throw toTrajectoryFrameError(error, input);
        }
    }

    public async getTrajectoryMetadata(input: TrajectoryFrameLookupInput): Promise<ParsedTrajectoryMetadata> {
        return (await this.readFrame(input)).metadata;
    }

    public async getPropertyStats(input: PropertyStatsInput): Promise<PropertyStatsResult> {
        /* A resident frame is already cheaper to scan than a fresh query. */
        const resident = this.trajectoryFrameStore.peekFrame?.(input) ?? null;
        if (!resident && this.trajectoryFrameStore.readPropertyStats) {
            const pushedDown = await this.trajectoryFrameStore.readPropertyStats(input, input.property);
            if (pushedDown) {
                return pushedDown;
            }
        }

        const column = this.getPropertyColumn(
            resident
                ? frameToParsedTrajectory(resident, await this.trajectoryFrameStore.readElementMetadata(input))
                : await this.readFrame(input),
            input.property
        );
        return {
            ...computeStats(column.values),
            dtype: column.dtype
        };
    }

    public async getUniqueValues(input: UniqueValuesInput): Promise<UniqueValuesResult> {
        const column = this.getPropertyColumn(await this.readFrame(input), input.property);
        return {
            values: collectUnique(column.values, input.maxValues),
            dtype: column.dtype
        };
    }

    /**
     * A page is a few thousand atoms, so decoding a whole frame to slice it is the
     * wrong shape once frames get large: at 10M atoms it costs seconds for a 20 KB
     * answer. A resident frame is still preferred — slicing it is free — but a cold
     * read asks the store for just the range, which it can satisfy without
     * materialising the rest. `pageOffset` tracks where the returned buffer starts,
     * since a range read is indexed from zero while a sliced frame is not.
     */
    public async getAtomsPage(input: AtomsPageInput): Promise<AtomsPageResult> {
        const pagination = normalizePagination(input.page, input.limit);
        const requestedStart = calculatePaginationOffset(pagination.page, pagination.limit);

        const resident = this.trajectoryFrameStore.peekFrame?.(input) ?? null;
        let parsed: ParsedTrajectory;
        let totalAtoms: number;
        let pageOffset: number;

        if (!resident && this.trajectoryFrameStore.readFrameRange) {
            const elementMetadata = await this.trajectoryFrameStore.readElementMetadata(input);
            let page;
            try {
                page = await this.trajectoryFrameStore.readFrameRange(input, {
                    startIndex: requestedStart,
                    endIndexExclusive: requestedStart + pagination.limit
                });
            } catch (error) {
                throw toTrajectoryFrameError(error, input);
            }
            parsed = frameToParsedTrajectory(page.frame, elementMetadata);
            totalAtoms = page.totalAtoms;
            pageOffset = requestedStart;
        } else {
            parsed = resident
                ? frameToParsedTrajectory(resident, await this.trajectoryFrameStore.readElementMetadata(input))
                : await this.readFrame(input);
            totalAtoms = parsed.ids ? parsed.ids.length : parsed.positions.length / 3;
            pageOffset = 0;
        }

        const startIndex = requestedStart - pageOffset;
        const endIndex = Math.min(
            parsed.ids ? parsed.ids.length : parsed.positions.length / 3,
            startIndex + pagination.limit
        );
        const properties = parsed.properties;
        const nativeProperties = Object.keys(properties);
        const propertyDtypes: Record<string, ColumnDType> = {};
        for (const propName of nativeProperties) {
            propertyDtypes[propName] = properties[propName].dtype;
        }
        const atoms: AtomsPageRow[] = [];

        for (let index = startIndex; index < endIndex; index++) {
            const atom: AtomsPageRow = {
                id: parsed.ids ? parsed.ids[index] : pageOffset + index + 1,
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

    public async getAtomIds(input: TrajectoryFrameLookupInput): Promise<number[]> {
        const parsed = await this.readFrame(input);
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for atom-id lookup');
        }
        return Array.from(parsed.ids);
    }

    public getPropertyColumn(parsed: ParsedTrajectory, property: string): TypedColumn {
        const lowerProperty = property.toLowerCase();
        const axisIndex = ['x', 'y', 'z'].indexOf(lowerProperty);

        if (lowerProperty === 'type') {
            return {
                dtype: 'i32',
                values: Int32Array.from(parsed.types)
            };
        }

        if (axisIndex >= 0) {
            const values = new Float32Array(parsed.positions.length / 3);
            for (let index = 0; index < values.length; index++) {
                values[index] = parsed.positions[index * 3 + axisIndex];
            }
            return {
                dtype: 'f32',
                values
            };
        }

        if (lowerProperty === 'id' && parsed.ids) {
            return {
                dtype: 'i32',
                values: Int32Array.from(parsed.ids)
            };
        }

        const source = parsed.properties[property] ?? parsed.properties[lowerProperty];
        return source ?? {
            dtype: 'f32',
            values: new Float32Array(0)
        };
    }

    public getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array {
        const { values } = this.getPropertyColumn(parsed, property);
        return values instanceof Float32Array ? values : Float32Array.from(values);
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
        return toTrajectoryFrameModelObjectKey(trajectoryId, timestep);
    }
}

export const getTrajectoryParser = singleton((): TrajectoryParser => new TrajectoryParser(getTrajectoryFrameStore()));

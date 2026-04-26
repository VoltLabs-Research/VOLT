import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import {
    resolveAnalysisComputeClusterId,
    resolveTrajectoryStorageClusterId
} from '@modules/cluster/application/utilities/cluster-location';
import { resolveTrajectoryNativeClusterContext } from '@modules/trajectory/utilities/team-cluster/resolve-trajectory-native-cluster-context';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';

import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';
import { injectable } from 'tsyringe';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type {
    AtomColumn,
    GetAtomsColumnarInputDTO,
    GetAtomsColumnarOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryReader from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryReader';
import type { IUseCase } from '@shared/application/IUseCase';

const ID_PROPERTY_NAME = 'id';
const TYPE_PROPERTY_NAME = 'type';
const POSITION_PROPERTY_NAMES = ['x', 'y', 'z'] as const;

const buildFloat32Column = (name: string, values: readonly number[]): AtomColumn => {
    const buffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
    new Float32Array(buffer).set(values as ArrayLike<number>);
    return { name, dtype: 'f32', buffer: new Uint8Array(buffer) };
};

const buildUint32Column = (name: string, values: readonly number[]): AtomColumn => {
    const buffer = new ArrayBuffer(values.length * Uint32Array.BYTES_PER_ELEMENT);
    new Uint32Array(buffer).set(values as ArrayLike<number>);
    return { name, dtype: 'u32', buffer: new Uint8Array(buffer) };
};

@injectable()
export class GetAtomsUseCase implements IUseCase<GetAtomsColumnarInputDTO, GetAtomsColumnarOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryReader: TrajectoryReader,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly analysisRepository: AnalysisRepository,

        
        private readonly teamClusterSelectionService: TeamClusterSelectionService
    ) {}

    async execute(input: GetAtomsColumnarInputDTO): Promise<Result<GetAtomsColumnarOutputDTO, ApplicationError>> {
        try {
            const { trajectoryId, timestep } = input;
            const analysisId = normalizeAnalysisId(input.analysisId);
            const page = input.page ?? 1;
            // Why: callers that hit the binary endpoint for the canvas engine
            // need the whole frame. A paginated default of 100 would silently
            // return a sparse view; the explicit opt-in stays paginated for
            // property-inspection tables.
            const limit = input.limit ?? 5_000_000;

            const pageNum = Math.max(1, page);
            const limitNum = Math.min(5_000_000, Math.max(1, limit));

            const trajectory = await this.trajectoryRepository.findById(trajectoryId);
            if (!trajectory) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.TRAJECTORY_NOT_FOUND,
                    'Trajectory not found'
                ));
            }

            const ownerClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
            let teamClusterId: string | undefined;
            if (analysisId) {
                const analysis = await this.analysisRepository.findById(analysisId);

                if (!analysis) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.ANALYSIS_NOT_FOUND,
                        'Analysis not found'
                    ));
                }

                if (analysis.props.trajectory !== trajectoryId) {
                    return Result.fail(ApplicationError.badRequest(
                        ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                        'Analysis does not belong to the requested trajectory'
                    ));
                }

                teamClusterId = resolveAnalysisComputeClusterId(analysis.props) ?? teamClusterId;
            } else {
                const clusterContext = await resolveTrajectoryNativeClusterContext({
                    trajectoryId,
                    trajectoryRepository: this.trajectoryRepository,
                    teamClusterSelectionService: this.teamClusterSelectionService
                });
                teamClusterId = clusterContext?.computeClusterId;
            }

            if (!teamClusterId) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.TRAJECTORY_TEAM_CLUSTER_REQUIRED,
                    'Trajectory storage or compute cluster is required to retrieve atoms'
                ));
            }

            const atomsPage = await this.trajectoryReader.readPage(
                teamClusterId,
                trajectoryId,
                timestep,
                pageNum,
                limitNum,
                analysisId,
                ownerClusterId
            );

            const nativeProperties = atomsPage.nativeProperties ?? [];
            const analysisPropertyNames = atomsPage.analysisPropertyNames ?? [];
            const allProps = [...nativeProperties, ...analysisPropertyNames];

            let perAtomData: Map<number, Record<string, unknown>> | null = null;
            if (atomsPage.analysisAtoms && atomsPage.analysisAtoms.length > 0) {
                perAtomData = new Map();
                for (const item of atomsPage.analysisAtoms) {
                    if (item?.id === undefined) continue;
                    perAtomData.set(Number(item.id), item);
                }
            }

            const rowCount = atomsPage.atoms.length;
            const ids = new Array<number>(rowCount);
            const types = new Array<number>(rowCount);
            const xs = new Array<number>(rowCount);
            const ys = new Array<number>(rowCount);
            const zs = new Array<number>(rowCount);
            const extraColumns = new Map<string, number[]>();
            for (const prop of allProps) {
                if (prop === ID_PROPERTY_NAME
                    || prop === TYPE_PROPERTY_NAME
                    || POSITION_PROPERTY_NAMES.includes(prop as (typeof POSITION_PROPERTY_NAMES)[number])) {
                    continue;
                }
                extraColumns.set(prop, new Array<number>(rowCount));
            }

            for (let row = 0; row < rowCount; row += 1) {
                const atom = atomsPage.atoms[row];
                const atomId = Number(atom.id);
                ids[row] = atomId;
                types[row] = Number(atom.type);
                xs[row] = Number(atom.x);
                ys[row] = Number(atom.y);
                zs[row] = Number(atom.z);

                for (const [prop, column] of extraColumns) {
                    const nativeValue = atom[prop];
                    if (typeof nativeValue === 'number') {
                        column[row] = nativeValue;
                        continue;
                    }

                    const analysisValue = perAtomData?.get(atomId)?.[prop];
                    column[row] = typeof analysisValue === 'number'
                        ? analysisValue
                        : Number(analysisValue ?? Number.NaN);
                }
            }

            const columns: AtomColumn[] = [
                buildUint32Column(ID_PROPERTY_NAME, ids),
                buildUint32Column(TYPE_PROPERTY_NAME, types),
                buildFloat32Column('x', xs),
                buildFloat32Column('y', ys),
                buildFloat32Column('z', zs)
            ];

            for (const [prop, values] of extraColumns) {
                columns.push(buildFloat32Column(prop, values));
            }

            const totalAtoms = atomsPage.totalAtoms;
            const totalPages = Math.ceil(totalAtoms / limitNum);

            return Result.ok({
                count: rowCount,
                total: totalAtoms,
                page: pageNum,
                limit: limitNum,
                totalPages,
                columns,
                propertyNames: allProps
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(
                ApplicationError.internalServerError('Failed to retrieve trajectory atoms')
            );
        }
    }
};

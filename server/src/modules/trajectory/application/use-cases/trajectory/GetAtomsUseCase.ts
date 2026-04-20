import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import {
    resolveAnalysisComputeClusterId,
    resolveTrajectoryStorageClusterId
} from '@modules/team-cluster/application/utilities/cluster-location';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { resolveTrajectoryNativeClusterContext } from '@modules/trajectory/utilities/team-cluster/resolve-trajectory-native-cluster-context';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';
import { injectable, inject } from 'tsyringe';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { AtomRecord, GetAtomsInputDTO } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export class GetAtomsUseCase implements IUseCase<GetAtomsInputDTO, PaginatedResult<AtomRecord>, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryReader)
        private readonly trajectoryReader: ITrajectoryReader,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService
    ) {}

    async execute(input: GetAtomsInputDTO): Promise<Result<PaginatedResult<AtomRecord>, ApplicationError>> {
        try {
            const { trajectoryId, timestep } = input;
            const analysisId = normalizeAnalysisId(input.analysisId);
            const page = input.page ?? 1;
            const limit = input.limit ?? 100;

            const pageNum = Math.max(1, page);
            const limitNum = Math.min(100000, Math.max(1, limit));

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

            const totalAtoms = atomsPage.totalAtoms;
            const nativeProperties = atomsPage.nativeProperties ?? [];
            const analysisPropertyNames = atomsPage.analysisPropertyNames ?? [];

            let perAtomData: Map<number, Record<string, unknown>> | null = null;
            if (atomsPage.analysisAtoms && atomsPage.analysisAtoms.length > 0) {
                perAtomData = new Map();
                for (const item of atomsPage.analysisAtoms) {
                    if (item?.id === undefined) continue;
                    perAtomData.set(Number(item.id), item);
                }
            }

            const atoms: AtomRecord[] = [];
            for (const atom of atomsPage.atoms) {
                const record: AtomRecord = {
                    id: atom.id,
                    type: atom.type,
                    x: atom.x,
                    y: atom.y,
                    z: atom.z
                };

                for (const prop of nativeProperties) {
                    if (atom[prop] !== undefined) {
                        record[prop] = atom[prop];
                    }
                }

                if (perAtomData?.has(atom.id)) {
                    const pluginData = perAtomData.get(atom.id)!;
                    for (const prop of analysisPropertyNames) {
                        const propertyValue = pluginData[prop];
                        if (propertyValue !== undefined) {
                            record[prop] = propertyValue;
                        }
                    }
                }

                atoms.push(record);
            }

            const totalPages = Math.ceil(totalAtoms / limitNum);

            return Result.ok({
                data: atoms,
                page: pageNum,
                limit: limitNum,
                total: totalAtoms,
                totalPages,
                _meta: { properties: [...nativeProperties, ...analysisPropertyNames] }
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

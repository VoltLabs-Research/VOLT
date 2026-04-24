import { GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';
import { resolveTrajectoryPreviewAvailability } from '@modules/trajectory/utilities/trajectory/resolve-trajectory-preview-availability';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { STORAGE_CLUSTER_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';

import { injectable } from 'tsyringe';

import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';

@injectable()
export default class GetTrajectoriesByTeamIdUseCase implements IUseCase<GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO, ApplicationError> {
    constructor(

        private readonly trajectoryRepo: TrajectoryRepository,

        private readonly rasterStorage: RasterStorageService,

        private readonly trajectoryFrameRepo: TrajectoryFrameRepository
    ) {}

    async execute(input: GetTrajectoriesByTeamIdInputDTO): Promise<Result<GetTrajectoriesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 20, search } = input;

        const filter: Record<string, unknown> = { team: teamId };
        if (input.folderId === 'root') {
            filter.folder = null;
        } else if (input.folderId) {
            filter.folder = input.folderId;
        }
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const results = await this.trajectoryRepo.findAll({
            filter,
            populate: [
                USER_POPULATE,
                STORAGE_CLUSTER_POPULATE
            ],
            sort: { updatedAt: -1 },
            page,
            limit
        });

        const summaries = await this.trajectoryFrameRepo.getListingSummariesByTrajectoryIds(
            results.data.map((trajectory) => trajectory.id)
        );

        const data = await Promise.all(results.data.map(async (trajectory) => {
            const summary = summaries.get(trajectory.id);
            trajectory.props.framesCount = summary?.framesCount ?? 0;
            trajectory.props.atoms = summary?.atoms ?? 0;
            trajectory.props.firstTimestep = summary?.firstTimestep;

            const persistedTrajectory = toPersistedOutput(trajectory);

            return resolveTrajectoryPreviewAvailability(
                persistedTrajectory,
                this.rasterStorage.hasTrajectoryPreview.bind(this.rasterStorage)
            );
        }));

        return Result.ok({
            ...results,
            data
        });
    }
};

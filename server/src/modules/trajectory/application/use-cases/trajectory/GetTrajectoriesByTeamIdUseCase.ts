import { GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';
import { resolveTrajectoryPreviewAvailability } from '@modules/trajectory/utilities/trajectory/resolve-trajectory-preview-availability';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';

import { injectable } from 'tsyringe';

import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';

@injectable()
export default class GetTrajectoriesByTeamIdUseCase implements IUseCase<GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryRepo: TrajectoryRepository,
        
        private readonly rasterStorage: RasterStorageService
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
                {
                    path: 'createdBy',
                    select: ['firstName', 'lastName', 'email', 'avatar']
                },
                {
                    path: 'storageClusterId',
                    select: ['name']
                }
            ],
            sort: { updatedAt: -1 },
            page,
            limit
        });

        const data = await Promise.all(results.data.map(async (trajectory) => {
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

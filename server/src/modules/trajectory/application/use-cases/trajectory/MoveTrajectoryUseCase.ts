import type { MoveTrajectoryInputDTO, MoveTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/MoveTrajectoryDTO';
import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class MoveTrajectoryUseCase
    extends MoveCatalogItemUseCase<MoveTrajectoryInputDTO, TrajectoryFolder, TrajectoryFolderProps, TrajectoryProps>
    implements IUseCase<MoveTrajectoryInputDTO, MoveTrajectoryOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        trajectoryRepository: ITrajectoryRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryFolderRepository)
        trajectoryFolderRepository: ITrajectoryFolderRepository
    ) {
        super(trajectoryRepository, trajectoryFolderRepository, {
            folderLabel: 'Trajectory folder',
            itemLabel: 'Trajectory',
            getItemId: (input) => input.trajectoryId
        });
    }
}

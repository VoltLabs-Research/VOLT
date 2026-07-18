import type { ITrajectoryFolderRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryFolderRepository';
import { inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryRepository';
import type { MoveTrajectoryInputDTO, MoveTrajectoryOutputDTO } from '@modules/trajectory/dtos/trajectory/MoveTrajectoryDTO';
import type { TrajectoryProps } from '@modules/trajectory/entities/trajectory/Trajectory';
import type TrajectoryFolder from '@modules/trajectory/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/entities/trajectory/TrajectoryFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class MoveTrajectoryUseCase
    extends MoveCatalogItemUseCase<MoveTrajectoryInputDTO, TrajectoryFolder, TrajectoryFolderProps, TrajectoryProps>
    implements IUseCase<MoveTrajectoryInputDTO, MoveTrajectoryOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) trajectoryRepository: ITrajectoryRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryFolderRepository) trajectoryFolderRepository: ITrajectoryFolderRepository
    ) {
        super(trajectoryRepository, trajectoryFolderRepository, {
            folderLabel: 'Trajectory folder',
            itemLabel: 'Trajectory',
            getItemId: (input) => input.trajectoryId
        });
    }
}

import type { MoveTrajectoryInputDTO, MoveTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/MoveTrajectoryDTO';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class MoveTrajectoryUseCase
    extends MoveCatalogItemUseCase<MoveTrajectoryInputDTO, TrajectoryFolder, TrajectoryFolderProps, TrajectoryProps>
    implements IUseCase<MoveTrajectoryInputDTO, MoveTrajectoryOutputDTO, ApplicationError> {
    constructor(
        
        trajectoryRepository: TrajectoryRepository,
        
        trajectoryFolderRepository: TrajectoryFolderRepository
    ) {
        super(trajectoryRepository, trajectoryFolderRepository, {
            folderLabel: 'Trajectory folder',
            itemLabel: 'Trajectory',
            getItemId: (input) => input.trajectoryId
        });
    }
}

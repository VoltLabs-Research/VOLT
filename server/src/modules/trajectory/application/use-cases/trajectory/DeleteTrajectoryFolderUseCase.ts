import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import { inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class DeleteTrajectoryFolderUseCase extends DeleteCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps, Trajectory, TrajectoryProps> {
    constructor(
        
        @inject(TRAJECTORY_TOKENS.TrajectoryFolderRepository) trajectoryFolderRepository: ITrajectoryFolderRepository,
        
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) trajectoryRepository: ITrajectoryRepository,
        
        deleteTrajectoryByIdUseCase: DeleteTrajectoryByIdUseCase
    ) {
        super(
            trajectoryFolderRepository,
            trajectoryRepository,
            async (trajectory) => {
                await deleteTrajectoryByIdUseCase.execute({
                    trajectoryId: trajectory._id
                });
            },
            { folderLabel: 'Trajectory folder' }
        );
    }
}

import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class DeleteTrajectoryFolderUseCase extends DeleteCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps, Trajectory, TrajectoryProps> {
    constructor(
        
        trajectoryFolderRepository: TrajectoryFolderRepository,
        
        trajectoryRepository: TrajectoryRepository,
        
        deleteTrajectoryByIdUseCase: DeleteTrajectoryByIdUseCase
    ) {
        super(
            trajectoryFolderRepository,
            trajectoryRepository,
            async (trajectory) => {
                const result = await deleteTrajectoryByIdUseCase.execute({
                    trajectoryId: trajectory._id
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            { folderLabel: 'Trajectory folder' }
        );
    }
}

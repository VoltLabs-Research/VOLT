import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import { UpdateCatalogFolderUseCase } from '@shared/application/catalog/UpdateCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class UpdateTrajectoryFolderUseCase extends UpdateCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps> {
    constructor(
        
        trajectoryFolderRepository: TrajectoryFolderRepository
    ) {
        super(trajectoryFolderRepository, { folderLabel: 'Trajectory folder' });
    }
}

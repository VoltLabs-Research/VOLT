import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import { CreateCatalogFolderUseCase } from '@shared/application/catalog/CreateCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class CreateTrajectoryFolderUseCase extends CreateCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps> {
    constructor(
        
        trajectoryFolderRepository: TrajectoryFolderRepository
    ) {
        super(trajectoryFolderRepository, { folderLabel: 'Trajectory folder' });
    }
}

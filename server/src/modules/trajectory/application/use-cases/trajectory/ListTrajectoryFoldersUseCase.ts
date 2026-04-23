import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import { ListCatalogFoldersUseCase } from '@shared/application/catalog/ListCatalogFoldersUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class ListTrajectoryFoldersUseCase extends ListCatalogFoldersUseCase<TrajectoryFolder, TrajectoryFolderProps> {
    constructor(
        
        trajectoryFolderRepository: TrajectoryFolderRepository
    ) {
        super(trajectoryFolderRepository);
    }
}

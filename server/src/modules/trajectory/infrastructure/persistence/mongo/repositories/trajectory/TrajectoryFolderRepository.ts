import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import TrajectoryFolder, { type TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import trajectoryFolderMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';


@Singleton(TRAJECTORY_TOKENS.TrajectoryFolderRepository)
export default class TrajectoryFolderRepository
    extends MongooseCatalogFolderRepository<TrajectoryFolder, TrajectoryFolderProps, CatalogFolderDocument> {
    constructor() {
        super(CatalogFolderModel, trajectoryFolderMapper, CatalogFolderKind.Trajectory);
    }
}

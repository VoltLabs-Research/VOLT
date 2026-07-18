import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import TrajectoryFolder, { type TrajectoryFolderProps } from '@modules/trajectory/entities/trajectory/TrajectoryFolder';
import trajectoryFolderMapper from '@modules/trajectory/mappers/trajectory/TrajectoryFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

import type { ITrajectoryFolderRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryFolderRepository';


@Singleton(TRAJECTORY_TOKENS.TrajectoryFolderRepository)
export default class TrajectoryFolderRepository
    extends MongooseCatalogFolderRepository<TrajectoryFolder, TrajectoryFolderProps, CatalogFolderDocument>
    implements ITrajectoryFolderRepository {
    constructor() {
        super(CatalogFolderModel, trajectoryFolderMapper, CatalogFolderKind.Trajectory);
    }
}

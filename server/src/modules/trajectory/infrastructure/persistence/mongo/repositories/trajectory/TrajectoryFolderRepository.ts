import TrajectoryFolder, { type TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import trajectoryFolderMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { injectable } from 'tsyringe';

@injectable()
export default class TrajectoryFolderRepository
    extends MongooseCatalogFolderRepository<TrajectoryFolder, TrajectoryFolderProps, CatalogFolderDocument>
    implements ITrajectoryFolderRepository {
    constructor() {
        super(CatalogFolderModel, trajectoryFolderMapper, CatalogFolderKind.Trajectory);
    }
}

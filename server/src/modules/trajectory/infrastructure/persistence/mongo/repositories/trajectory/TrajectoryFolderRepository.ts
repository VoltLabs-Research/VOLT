import TrajectoryFolder, { type TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import trajectoryFolderMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryFolderMapper';
import TrajectoryFolderModel, { type TrajectoryFolderDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryFolderModel';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class TrajectoryFolderRepository
    extends MongooseCatalogFolderRepository<TrajectoryFolder, TrajectoryFolderProps, TrajectoryFolderDocument>
    implements ITrajectoryFolderRepository {
    constructor() {
        super(TrajectoryFolderModel, trajectoryFolderMapper);
    }
}

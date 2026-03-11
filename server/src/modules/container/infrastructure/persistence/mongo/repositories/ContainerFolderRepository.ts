import ContainerFolder, { type ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import containerFolderMapper from '@modules/container/infrastructure/persistence/mongo/mappers/ContainerFolderMapper';
import ContainerFolderModel, { type ContainerFolderDocument } from '@modules/container/infrastructure/persistence/mongo/models/ContainerFolderModel';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import { injectable } from 'tsyringe';

@injectable()
export class ContainerFolderRepository
    extends MongooseCatalogFolderRepository<ContainerFolder, ContainerFolderProps, ContainerFolderDocument>
    implements IContainerFolderRepository {
    constructor() {
        super(ContainerFolderModel, containerFolderMapper);
    }
}

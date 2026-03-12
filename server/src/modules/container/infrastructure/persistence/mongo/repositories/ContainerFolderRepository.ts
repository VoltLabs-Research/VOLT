import ContainerFolder, { type ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import containerFolderMapper from '@modules/container/infrastructure/persistence/mongo/mappers/ContainerFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { injectable } from 'tsyringe';

@injectable()
export class ContainerFolderRepository
    extends MongooseCatalogFolderRepository<ContainerFolder, ContainerFolderProps, CatalogFolderDocument>
    implements IContainerFolderRepository {
    constructor() {
        super(CatalogFolderModel, containerFolderMapper, CatalogFolderKind.Container);
    }
}

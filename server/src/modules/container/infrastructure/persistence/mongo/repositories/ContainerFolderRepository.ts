import ContainerFolder, { type ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import containerFolderMapper from '@modules/container/infrastructure/persistence/mongo/mappers/ContainerFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Transient } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';


@Transient()
export class ContainerFolderRepository
    extends MongooseCatalogFolderRepository<ContainerFolder, ContainerFolderProps, CatalogFolderDocument> {
    constructor() {
        super(CatalogFolderModel, containerFolderMapper, CatalogFolderKind.Container);
    }
}

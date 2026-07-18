import ContainerFolder, { type ContainerFolderProps } from '@modules/container/entities/ContainerFolder';
import type { IContainerFolderRepository } from '@modules/container/ports/IContainerFolderRepository';
import { CONTAINER_TOKENS } from '@modules/container/di/ContainerTokens';
import containerFolderMapper from '@modules/container/mappers/ContainerFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';


@Singleton(CONTAINER_TOKENS.ContainerFolderRepository)
export class ContainerFolderRepository
    extends MongooseCatalogFolderRepository<ContainerFolder, ContainerFolderProps, CatalogFolderDocument>
    implements IContainerFolderRepository {
    constructor() {
        super(CatalogFolderModel, containerFolderMapper, CatalogFolderKind.Container);
    }
}

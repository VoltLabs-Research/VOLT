import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { ListCatalogFoldersUseCase } from '@shared/application/catalog/ListCatalogFoldersUseCase';
import { injectable } from 'tsyringe';

@injectable()
export class ListContainerFoldersUseCase extends ListCatalogFoldersUseCase<ContainerFolder, ContainerFolderProps> {
    constructor(
        containerFolderRepository: ContainerFolderRepository
    ) {
        super(containerFolderRepository);
    }
}

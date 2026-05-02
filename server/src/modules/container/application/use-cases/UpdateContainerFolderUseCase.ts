import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { UpdateCatalogFolderUseCase } from '@shared/application/catalog/UpdateCatalogFolderUseCase';
import { injectable } from 'tsyringe';

@injectable()
export class UpdateContainerFolderUseCase extends UpdateCatalogFolderUseCase<ContainerFolder, ContainerFolderProps> {
    constructor(
        containerFolderRepository: ContainerFolderRepository
    ) {
        super(containerFolderRepository, { folderLabel: 'Container folder' });
    }
}

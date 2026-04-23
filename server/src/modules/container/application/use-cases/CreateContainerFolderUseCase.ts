import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { CreateCatalogFolderUseCase } from '@shared/application/catalog/CreateCatalogFolderUseCase';
import { injectable } from 'tsyringe';

@injectable()
export class CreateContainerFolderUseCase extends CreateCatalogFolderUseCase<ContainerFolder, ContainerFolderProps> {
    constructor(
        
        containerFolderRepository: ContainerFolderRepository
    ) {
        super(containerFolderRepository, { folderLabel: 'Container folder' });
    }
}

import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { GetCatalogFolderUseCase } from '@shared/application/catalog/GetCatalogFolderUseCase';
import { injectable } from 'tsyringe';

@injectable()
export class GetContainerFolderUseCase extends GetCatalogFolderUseCase<ContainerFolder, ContainerFolderProps> {
    constructor(
        
        containerFolderRepository: ContainerFolderRepository
    ) {
        super(containerFolderRepository, { folderLabel: 'Container folder' });
    }
}

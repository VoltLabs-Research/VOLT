import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { UpdateCatalogFolderUseCase } from '@shared/application/catalog/UpdateCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class UpdateContainerFolderUseCase extends UpdateCatalogFolderUseCase<ContainerFolder, ContainerFolderProps> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerFolderRepository)
        containerFolderRepository: IContainerFolderRepository
    ) {
        super(containerFolderRepository, { folderLabel: 'Container folder' });
    }
}

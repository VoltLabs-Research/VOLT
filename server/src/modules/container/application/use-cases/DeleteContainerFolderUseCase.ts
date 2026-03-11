import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteContainerFolderUseCase extends DeleteCatalogFolderUseCase<ContainerFolder, ContainerFolderProps, IContainerProps> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerFolderRepository)
        containerFolderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRepository)
        containerRepository: IContainerRepository
    ) {
        super(containerFolderRepository, containerRepository, { folderLabel: 'Container folder' });
    }
}

import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { GetCatalogFolderUseCase } from '@shared/application/catalog/GetCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerFolderUseCase extends GetCatalogFolderUseCase<ContainerFolder, ContainerFolderProps> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerFolderRepository)
        containerFolderRepository: IContainerFolderRepository
    ) {
        super(containerFolderRepository, { folderLabel: 'Container folder' });
    }
}

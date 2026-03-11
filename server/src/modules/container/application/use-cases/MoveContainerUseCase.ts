import type { MoveContainerInputDTO, MoveContainerOutputDTO } from '@modules/container/application/dtos/MoveContainerDTO';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';

@injectable()
export class MoveContainerUseCase
    extends MoveCatalogItemUseCase<MoveContainerInputDTO, ContainerFolder, ContainerFolderProps, IContainerProps>
    implements IUseCase<MoveContainerInputDTO, MoveContainerOutputDTO, ApplicationError> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository)
        containerRepository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerFolderRepository)
        containerFolderRepository: IContainerFolderRepository
    ) {
        super(containerRepository, containerFolderRepository, {
            folderLabel: 'Container folder',
            itemLabel: 'Container',
            getItemId: (input) => input.containerId
        });
    }
}

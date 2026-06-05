import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import type { MoveContainerInputDTO, MoveContainerOutputDTO } from '@modules/container/application/dtos/MoveContainerDTO';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class MoveContainerUseCase
    extends MoveCatalogItemUseCase<MoveContainerInputDTO, ContainerFolder, ContainerFolderProps, IContainerProps>
    implements IUseCase<MoveContainerInputDTO, MoveContainerOutputDTO, ApplicationError> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private readonly containerRepository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerFolderRepository) private readonly containerFolderRepository: IContainerFolderRepository
    ) {
        super(containerRepository, containerFolderRepository, {
            folderLabel: 'Container folder',
            itemLabel: 'Container',
            getItemId: (input) => input.containerId
        });
    }
}

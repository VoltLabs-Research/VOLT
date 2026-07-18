import { CONTAINER_TOKENS } from '@modules/container/di/ContainerTokens';
import type { IContainerRepository } from '@modules/container/ports/IContainerRepository';
import type { IContainerFolderRepository } from '@modules/container/ports/IContainerFolderRepository';
import type { MoveContainerInputDTO, MoveContainerOutputDTO } from '@modules/container/dtos/MoveContainerDTO';
import type { IContainerProps } from '@modules/container/entities/Container';
import type ContainerFolder from '@modules/container/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/entities/ContainerFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class MoveContainerUseCase
    extends MoveCatalogItemUseCase<MoveContainerInputDTO, ContainerFolder, ContainerFolderProps, IContainerProps>
    implements IUseCase<MoveContainerInputDTO, MoveContainerOutputDTO> {
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

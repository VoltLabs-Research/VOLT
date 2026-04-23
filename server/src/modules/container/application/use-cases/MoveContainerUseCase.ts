import type { MoveContainerInputDTO, MoveContainerOutputDTO } from '@modules/container/application/dtos/MoveContainerDTO';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { injectable } from 'tsyringe';

@injectable()
export class MoveContainerUseCase
    extends MoveCatalogItemUseCase<MoveContainerInputDTO, ContainerFolder, ContainerFolderProps, IContainerProps>
    implements IUseCase<MoveContainerInputDTO, MoveContainerOutputDTO, ApplicationError> {
    constructor(
        
        containerRepository: ContainerRepository,
        
        containerFolderRepository: ContainerFolderRepository
    ) {
        super(containerRepository, containerFolderRepository, {
            folderLabel: 'Container folder',
            itemLabel: 'Container',
            getItemId: (input) => input.containerId
        });
    }
}

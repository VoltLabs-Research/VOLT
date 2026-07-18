import { CONTAINER_TOKENS } from '@modules/container/di/ContainerTokens';
import type { IContainerRepository } from '@modules/container/ports/IContainerRepository';
import type { IContainerFolderRepository } from '@modules/container/ports/IContainerFolderRepository';
import type { DeleteContainerFolderInputDTO, DeleteContainerFolderOutputDTO } from '@modules/container/dtos/DeleteContainerFolderDTO';
import { DeleteContainerUseCase } from '@modules/container/use-cases/DeleteContainerUseCase';
import type { IContainerProps } from '@modules/container/entities/Container';
import { Container } from '@modules/container/entities/Container';
import type ContainerFolder from '@modules/container/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/entities/ContainerFolder';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteContainerFolderUseCase
    extends DeleteCatalogFolderUseCase<
        ContainerFolder,
        ContainerFolderProps,
        Container,
        IContainerProps,
        DeleteContainerFolderInputDTO,
        { userId: string }
    >
    implements IUseCase<DeleteContainerFolderInputDTO, DeleteContainerFolderOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerFolderRepository) private readonly containerFolderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRepository) private readonly containerRepository: IContainerRepository,
        deleteContainerUseCase: DeleteContainerUseCase
    ) {
        super(
            containerFolderRepository,
            containerRepository,
            async (container, teamId, context) => {
                await deleteContainerUseCase.execute({
                    teamId,
                    containerId: container._id,
                    userId: context.userId
                });
            },
            {
                folderLabel: 'Container folder',
                getDeleteContext: (input) => ({ userId: input.userId })
            }
        );
    }
}

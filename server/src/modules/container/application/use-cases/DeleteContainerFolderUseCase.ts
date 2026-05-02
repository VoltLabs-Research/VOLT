import type { DeleteContainerFolderInputDTO, DeleteContainerFolderOutputDTO } from '@modules/container/application/dtos/DeleteContainerFolderDTO';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import { Container } from '@modules/container/domain/entities/Container';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { injectable } from 'tsyringe';

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
    implements IUseCase<DeleteContainerFolderInputDTO, DeleteContainerFolderOutputDTO, ApplicationError> {
    constructor(
        containerFolderRepository: ContainerFolderRepository,
        containerRepository: ContainerRepository,
        deleteContainerUseCase: DeleteContainerUseCase
    ) {
        super(
            containerFolderRepository,
            containerRepository,
            async (container, teamId, context) => {
                const result = await deleteContainerUseCase.execute({
                    teamId,
                    containerId: container._id,
                    userId: context.userId
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            {
                folderLabel: 'Container folder',
                getDeleteContext: (input) => ({ userId: input.userId })
            }
        );
    }
}

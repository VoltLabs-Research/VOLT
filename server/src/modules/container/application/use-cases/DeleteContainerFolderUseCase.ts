import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import { Container } from '@modules/container/domain/entities/Container';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteContainerFolderUseCase extends DeleteCatalogFolderUseCase<ContainerFolder, ContainerFolderProps, Container, IContainerProps> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerFolderRepository)
        containerFolderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRepository)
        containerRepository: IContainerRepository,
        @inject(DeleteContainerUseCase)
        deleteContainerUseCase: DeleteContainerUseCase
    ) {
        super(
            containerFolderRepository,
            containerRepository,
            async (container, teamId) => {
                const result = await deleteContainerUseCase.execute({
                    teamId,
                    containerId: container._id
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            { folderLabel: 'Container folder' }
        );
    }
}

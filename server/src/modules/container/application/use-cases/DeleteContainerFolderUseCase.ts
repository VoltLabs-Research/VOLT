import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteContainerFolderInputDTO, DeleteContainerFolderOutputDTO } from '@modules/container/application/dtos/DeleteContainerFolderDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import { deleteCatalogFolderTree } from '@shared/application/catalog/deleteCatalogFolderTree';
import { Result } from '@shared/domain/port/Result';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import { Container } from '@modules/container/domain/entities/Container';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteContainerFolderUseCase implements IUseCase<DeleteContainerFolderInputDTO, DeleteContainerFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerFolderRepository)
        private readonly containerFolderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRepository)
        private readonly containerRepository: IContainerRepository,
        @inject(DeleteContainerUseCase)
        private readonly deleteContainerUseCase: DeleteContainerUseCase
    ) {}

    async execute(input: DeleteContainerFolderInputDTO): Promise<Result<DeleteContainerFolderOutputDTO, ApplicationError>> {
        try {
            const folder = await this.containerFolderRepository.findByTeamAndFolderId(input.teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Container folder not found'
                ));
            }

            await deleteCatalogFolderTree<ContainerFolder, ContainerFolderProps, Container, IContainerProps>({
                teamId: input.teamId,
                folderId: input.folderId,
                folderRepository: this.containerFolderRepository,
                itemRepository: this.containerRepository,
                deleteItem: async (container, teamId) => {
                    const result = await this.deleteContainerUseCase.execute({
                        teamId,
                        containerId: container._id,
                        userId: input.userId
                    });

                    if (!result.success) {
                        throw result.error;
                    }
                }
            });

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete Container folder',
                500
            ));
        }
    }
}

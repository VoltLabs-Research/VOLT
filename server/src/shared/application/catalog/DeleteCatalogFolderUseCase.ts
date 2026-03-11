import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import { deleteCatalogFolderTree } from '@shared/application/catalog/deleteCatalogFolderTree';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import type { DeleteCatalogFolderInputDTO } from './catalog-folder-dto';
import type { CatalogFolderMessages } from './CatalogFolderMessages';

export abstract class DeleteCatalogFolderUseCase<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItemProps extends object
> implements IUseCase<DeleteCatalogFolderInputDTO, null, ApplicationError> {
    constructor(
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>,
        private readonly itemRepository: IBaseRepository<unknown, TItemProps>,
        private readonly messages: CatalogFolderMessages
    ) {}

    async execute(input: DeleteCatalogFolderInputDTO): Promise<Result<null, ApplicationError>> {
        try {
            const folder = await this.folderRepository.findByTeamAndFolderId(input.teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `${this.messages.folderLabel} not found`
                ));
            }

            await deleteCatalogFolderTree({
                teamId: input.teamId,
                folderId: input.folderId,
                folderRepository: this.folderRepository,
                itemRepository: this.itemRepository
            });

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to delete ${this.messages.folderLabel}`,
                500
            ));
        }
    }
}

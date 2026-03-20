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

interface DeleteCatalogFolderUseCaseOptions<TInput extends DeleteCatalogFolderInputDTO, TDeleteContext>
    extends CatalogFolderMessages {
    getDeleteContext?: (input: TInput) => TDeleteContext;
}

export abstract class DeleteCatalogFolderUseCase<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItem extends { _id: string },
    TItemProps extends object,
    TInput extends DeleteCatalogFolderInputDTO = DeleteCatalogFolderInputDTO,
    TDeleteContext = void
> implements IUseCase<TInput, null, ApplicationError> {
    constructor(
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>,
        private readonly itemRepository: IBaseRepository<TItem, TItemProps>,
        private readonly deleteItem: (item: TItem, teamId: string, context: TDeleteContext) => Promise<void>,
        private readonly options: DeleteCatalogFolderUseCaseOptions<TInput, TDeleteContext>
    ) {}

    async execute(input: TInput): Promise<Result<null, ApplicationError>> {
        try {
            const folder = await this.folderRepository.findByTeamAndFolderId(input.teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `${this.options.folderLabel} not found`
                ));
            }

            const deleteContext = this.options.getDeleteContext
                ? this.options.getDeleteContext(input)
                : undefined as TDeleteContext;

            await deleteCatalogFolderTree({
                teamId: input.teamId,
                folderId: input.folderId,
                folderRepository: this.folderRepository,
                itemRepository: this.itemRepository,
                deleteItem: (item, teamId) => this.deleteItem(item, teamId, deleteContext)
            });

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to delete ${this.options.folderLabel}`,
                500
            ));
        }
    }
}

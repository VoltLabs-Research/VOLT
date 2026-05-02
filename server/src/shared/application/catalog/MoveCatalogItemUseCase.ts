import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import type { CatalogFolderMessages } from './CatalogFolderMessages';

interface MoveCatalogItemInputDTO {
    teamId: string;
    folderId: string | null;
}

interface MoveCatalogItemUseCaseOptions<TInput, TItemProps extends object> extends CatalogFolderMessages {
    getItemId: (input: TInput) => string;
    itemTeamField?: keyof TItemProps & string;
    itemFolderField?: keyof TItemProps & string;
}

export abstract class MoveCatalogItemUseCase<
    TInput extends MoveCatalogItemInputDTO,
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItemProps extends object
> implements IUseCase<TInput, null, ApplicationError> {
    constructor(
        private readonly itemRepository: IBaseRepository<unknown, TItemProps>,
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>,
        private readonly options: MoveCatalogItemUseCaseOptions<TInput, TItemProps>
    ) {}

    async execute(input: TInput): Promise<Result<null, ApplicationError>> {
        try {
            const itemId = this.options.getItemId(input);
            const item = await this.itemRepository.findOne({
                _id: itemId,
                [this.options.itemTeamField ?? 'team']: input.teamId
            } as unknown as Partial<TItemProps>);

            if (!item) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `${this.options.itemLabel ?? 'Item'} not found`
                ));
            }

            if (input.folderId !== null) {
                const folder = await this.folderRepository.findByTeamAndFolderId(input.teamId, input.folderId);
                if (!folder) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.RESOURCE_NOT_FOUND,
                        `Target ${this.options.folderLabel} not found`
                    ));
                }
            }

            await this.itemRepository.updateById(itemId, {
                [this.options.itemFolderField ?? 'folder']: input.folderId
            } as unknown as Partial<TItemProps>);

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to move ${this.options.itemLabel ?? 'item'}`,
                500
            ));
        }
    }
}

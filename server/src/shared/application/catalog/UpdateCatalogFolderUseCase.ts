import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import { Result } from '@shared/domain/port/Result';
import type { CatalogFolderDTO, UpdateCatalogFolderInputDTO } from './catalog-folder-dto';
import type { CatalogFolderMessages } from './CatalogFolderMessages';
import { presentCatalogFolder } from './catalog-folder-presenter';

export abstract class UpdateCatalogFolderUseCase<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps
> implements IUseCase<UpdateCatalogFolderInputDTO, CatalogFolderDTO, ApplicationError> {
    constructor(
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>,
        private readonly messages: CatalogFolderMessages
    ) {}

    async execute(input: UpdateCatalogFolderInputDTO): Promise<Result<CatalogFolderDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Folder title is required'
                ));
            }

            const folder = await this.folderRepository.findByTeamAndFolderId(input.teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `${this.messages.folderLabel} not found`
                ));
            }

            const updated = await this.folderRepository.updateById(input.folderId, {
                title,
                updatedAt: new Date()
            } as Partial<TFolderProps>);

            return Result.ok(presentCatalogFolder(updated ?? folder));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to update ${this.messages.folderLabel}`,
                500
            ));
        }
    }
}

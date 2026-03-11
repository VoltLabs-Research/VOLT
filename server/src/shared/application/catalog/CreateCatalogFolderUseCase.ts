import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import { Result } from '@shared/domain/port/Result';
import type { CreateCatalogFolderInputDTO, CatalogFolderDTO } from './catalog-folder-dto';
import type { CatalogFolderMessages } from './CatalogFolderMessages';
import { presentCatalogFolder } from './catalog-folder-presenter';

export abstract class CreateCatalogFolderUseCase<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps
> implements IUseCase<CreateCatalogFolderInputDTO, CatalogFolderDTO, ApplicationError> {
    constructor(
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>,
        private readonly messages: CatalogFolderMessages
    ) {}

    async execute(input: CreateCatalogFolderInputDTO): Promise<Result<CatalogFolderDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Folder title is required'
                ));
            }

            const folder = await this.folderRepository.create({
                team: input.teamId,
                createdBy: input.userId,
                title,
                parent: input.parentId ?? null,
                createdAt: new Date(),
                updatedAt: new Date()
            } as TFolderProps);

            return Result.ok(presentCatalogFolder(folder));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to create ${this.messages.folderLabel}`,
                500
            ));
        }
    }
}

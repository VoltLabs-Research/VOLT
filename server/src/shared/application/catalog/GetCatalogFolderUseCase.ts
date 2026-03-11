import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import { Result } from '@shared/domain/port/Result';
import type { CatalogFolderDTO, GetCatalogFolderInputDTO } from './catalog-folder-dto';
import type { CatalogFolderMessages } from './CatalogFolderMessages';
import { presentCatalogFolder } from './catalog-folder-presenter';

export abstract class GetCatalogFolderUseCase<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps
> implements IUseCase<GetCatalogFolderInputDTO, CatalogFolderDTO, ApplicationError> {
    constructor(
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>,
        private readonly messages: CatalogFolderMessages
    ) {}

    async execute(input: GetCatalogFolderInputDTO): Promise<Result<CatalogFolderDTO, ApplicationError>> {
        try {
            const folder = await this.folderRepository.findByTeamAndFolderId(input.teamId, input.folderId);

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `${this.messages.folderLabel} not found`
                ));
            }

            return Result.ok(presentCatalogFolder(folder));
        } catch {
            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to fetch ${this.messages.folderLabel}`,
                500
            ));
        }
    }
}

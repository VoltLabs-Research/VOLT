import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import { Result } from '@shared/domain/port/Result';
import type { ListCatalogFoldersInputDTO, ListCatalogFoldersOutputDTO } from './catalog-folder-dto';
import { presentCatalogFolder } from './catalog-folder-presenter';

export abstract class ListCatalogFoldersUseCase<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps
> implements IUseCase<ListCatalogFoldersInputDTO, ListCatalogFoldersOutputDTO, ApplicationError> {
    constructor(
        private readonly folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>
    ) {}

    async execute(input: ListCatalogFoldersInputDTO): Promise<Result<ListCatalogFoldersOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));
        const parentId = input.parentId !== undefined ? input.parentId : null;
        const result = await this.folderRepository.findAllByTeamAndParent(input.teamId, parentId, { page, limit });

        return Result.ok({
            ...result,
            data: result.data.map((folder) => presentCatalogFolder(folder))
        });
    }
}

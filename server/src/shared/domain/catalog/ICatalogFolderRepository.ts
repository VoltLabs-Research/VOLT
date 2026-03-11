import type { IBaseRepository, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { CatalogFolderEntity, CatalogFolderProps } from './CatalogFolder';

export interface ICatalogFolderRepository<
    TFolder extends CatalogFolderEntity<TProps>,
    TProps extends CatalogFolderProps = CatalogFolderProps
> extends IBaseRepository<TFolder, TProps> {
    findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<TFolder>>;
    findByTeamAndFolderId(teamId: string, folderId: string): Promise<TFolder | null>;
};

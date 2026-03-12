import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';

export interface LatexFolderPaginationOptions {
    parentId?: string | null;
};

export interface ILatexFolderRepository extends ICatalogFolderRepository<LatexFolder, LatexFolderProps> {}

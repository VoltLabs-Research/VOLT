import type { LatexFolderProps } from '@modules/latex/entities/LatexFolder';
import type LatexFolder from '@modules/latex/entities/LatexFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';

export interface ILatexFolderRepository extends ICatalogFolderRepository<LatexFolder, LatexFolderProps> {}

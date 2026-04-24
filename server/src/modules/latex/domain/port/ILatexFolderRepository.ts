import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';

export interface ILatexFolderRepository extends ICatalogFolderRepository<LatexFolder, LatexFolderProps> {}

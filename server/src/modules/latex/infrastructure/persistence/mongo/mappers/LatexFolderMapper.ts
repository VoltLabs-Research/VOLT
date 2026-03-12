import LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapper<LatexFolder, LatexFolderProps, CatalogFolderDocument>(
    LatexFolder,
    ['team', 'createdBy', 'parent']
);

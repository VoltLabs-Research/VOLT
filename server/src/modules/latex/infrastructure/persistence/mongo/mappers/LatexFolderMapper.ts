import { createLatexFolder } from '@modules/latex/domain/entities/LatexFolder';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapperFromFactory<LatexFolder, LatexFolderProps, CatalogFolderDocument>(
    createLatexFolder,
    ['team', 'createdBy', 'parent']
);

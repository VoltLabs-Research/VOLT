import LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexFolderModel';

export default createMongoMapper<LatexFolder, LatexFolderProps, LatexFolderDocument>(
    LatexFolder,
    ['team', 'createdBy', 'parent']
);

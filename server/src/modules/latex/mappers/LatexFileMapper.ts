import LatexFile from '@modules/latex/entities/LatexFile';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { LatexFileProps } from '@modules/latex/entities/LatexFile';
import type { LatexFileDocument } from '@modules/latex/models/LatexFileModel';

export default createMongoMapper<LatexFile, LatexFileProps, LatexFileDocument>(
    LatexFile,
    ['document', 'team', 'createdBy']
);

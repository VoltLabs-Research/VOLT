import LatexFile from '@modules/latex/domain/entities/LatexFile';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { LatexFileProps } from '@modules/latex/domain/entities/LatexFile';
import type { LatexFileDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexFileModel';

export default createMongoMapper<LatexFile, LatexFileProps, LatexFileDocument>(
    LatexFile,
    ['document', 'team', 'createdBy']
);

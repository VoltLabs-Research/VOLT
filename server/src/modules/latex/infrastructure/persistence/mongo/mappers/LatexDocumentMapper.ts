import { createLatexDocument } from '@modules/latex/domain/entities/LatexDocument';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { LatexDocumentDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';

export default createMongoMapperFromFactory<LatexDocument, LatexDocumentProps, LatexDocumentDocument>(
    createLatexDocument,
    ['team', 'createdBy', 'lastEditedBy', 'folder']
);

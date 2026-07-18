import { createLatexDocument } from '@modules/latex/entities/LatexDocument';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type LatexDocument from '@modules/latex/entities/LatexDocument';
import type { LatexDocumentProps } from '@modules/latex/entities/LatexDocument';
import type { LatexDocumentDocument } from '@modules/latex/models/LatexDocumentModel';

export default createMongoMapperFromFactory<LatexDocument, LatexDocumentProps, LatexDocumentDocument>(
    createLatexDocument,
    ['team', 'createdBy', 'lastEditedBy', 'folder']
);

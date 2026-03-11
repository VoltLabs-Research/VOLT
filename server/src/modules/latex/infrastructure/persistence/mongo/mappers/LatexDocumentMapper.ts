import LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { LatexDocumentDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';

export default createMongoMapper<LatexDocument, LatexDocumentProps, LatexDocumentDocument>(
    LatexDocument,
    ['team', 'createdBy']
);

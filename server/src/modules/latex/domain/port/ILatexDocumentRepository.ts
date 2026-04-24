import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type LatexDocument from '@modules/latex/domain/entities/LatexDocument';

export interface ILatexDocumentRepository extends IBaseRepository<LatexDocument, LatexDocumentProps> {
    findByTeamAndDocumentId(teamId: string, documentId: string): Promise<LatexDocument | null>;
};

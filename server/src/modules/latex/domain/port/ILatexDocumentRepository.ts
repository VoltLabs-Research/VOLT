import type {
    IBaseRepository,
    PaginatedResult,
    PaginationOptions
} from '@shared/domain/port/IBaseRepository';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type LatexDocument from '@modules/latex/domain/entities/LatexDocument';

export interface LatexDocumentPaginationOptions extends PaginationOptions {
    search?: string;
    folderId?: string | null | 'all';
};

export interface ILatexDocumentRepository extends IBaseRepository<LatexDocument, LatexDocumentProps> {
    findAllByTeam(teamId: string, options: LatexDocumentPaginationOptions): Promise<PaginatedResult<LatexDocument>>;
    findByTeamAndDocumentId(teamId: string, documentId: string): Promise<LatexDocument | null>;
};

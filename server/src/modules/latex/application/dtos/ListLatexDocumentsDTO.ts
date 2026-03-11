import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface ListLatexDocumentsInputDTO {
    teamId: string;
    page?: number | string;
    limit?: number | string;
};

export interface ListLatexDocumentsOutputDTO extends PaginatedResult<LatexDocumentDTO> {};

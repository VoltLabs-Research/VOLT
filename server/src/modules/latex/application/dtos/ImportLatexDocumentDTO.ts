import type { LatexDocumentDTO } from './LatexDocumentDTO';
import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export type ImportLatexDocumentInputDTO = TeamUserScopedInputDTO & {
    file: Express.Multer.File;
    folderId?: string | null;
};

export type ImportLatexDocumentOutputDTO = LatexDocumentDTO;

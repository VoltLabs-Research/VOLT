import type { LatexFileDTO } from './LatexFileDTO';
import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UpdateLatexFileInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'fileId'> & {
    name?: string;
    path?: string;
    content?: string;
};

export type UpdateLatexFileOutputDTO = LatexFileDTO;

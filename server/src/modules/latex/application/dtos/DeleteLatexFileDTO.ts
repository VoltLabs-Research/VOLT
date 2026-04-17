import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteLatexFileInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'fileId'>;

export type DeleteLatexFileOutputDTO = void;

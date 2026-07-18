import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type SetLatexFileEntrypointInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'fileId'>;

import type { LatexFileDTO } from './LatexFileDTO';
import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type SetLatexFileEntrypointInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'fileId'>;

export type SetLatexFileEntrypointOutputDTO = LatexFileDTO;

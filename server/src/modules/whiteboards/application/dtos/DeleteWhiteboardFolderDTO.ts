import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteWhiteboardFolderInputDTO = TeamUserScopedEntityIdInputDTO<'folderId'>;

export type DeleteWhiteboardFolderOutputDTO = null;

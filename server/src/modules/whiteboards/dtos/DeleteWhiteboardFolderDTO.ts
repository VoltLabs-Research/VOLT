import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type DeleteWhiteboardFolderInputDTO = TeamUserScopedEntityIdInputDTO<'folderId'>;

export type DeleteWhiteboardFolderOutputDTO = null;

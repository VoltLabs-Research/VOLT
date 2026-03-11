import type { WhiteboardFolderDTO } from './WhiteboardFolderDTO';

export interface UpdateWhiteboardFolderInputDTO {
    teamId: string;
    folderId: string;
    title: string;
};

export type UpdateWhiteboardFolderOutputDTO = WhiteboardFolderDTO;

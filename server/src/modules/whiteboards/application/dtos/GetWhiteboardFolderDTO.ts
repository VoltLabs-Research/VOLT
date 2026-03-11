import type { WhiteboardFolderDTO } from './WhiteboardFolderDTO';

export interface GetWhiteboardFolderInputDTO {
    teamId: string;
    folderId: string;
};

export interface GetWhiteboardFolderOutputDTO extends WhiteboardFolderDTO {};

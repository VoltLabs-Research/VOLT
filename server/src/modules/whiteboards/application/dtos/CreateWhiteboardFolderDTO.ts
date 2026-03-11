import type { WhiteboardFolderDTO } from './WhiteboardFolderDTO';

export interface CreateWhiteboardFolderInputDTO {
    teamId: string;
    userId: string;
    title: string;
    parentId?: string | null;
};

export type CreateWhiteboardFolderOutputDTO = WhiteboardFolderDTO;

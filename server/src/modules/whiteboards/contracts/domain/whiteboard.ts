import ApplicationError from '@shared/application/errors/ApplicationError';

export interface PopulatedWhiteboardUser{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export type WhiteboardLastEditedBy = string | PopulatedWhiteboardUser | null;

export const requireWhiteboardStorageClusterId = (whiteboardId: string, storageClusterId?: string | null): string => {
    if(storageClusterId && storageClusterId.trim().length > 0){
        return storageClusterId;
    }

    throw ApplicationError.conflict(
        'Whiteboard::StorageClusterRequired',
        `Whiteboard ${whiteboardId} does not have a storage cluster assigned`
    );
};

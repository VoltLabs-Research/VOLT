import ApplicationError from '@shared/application/errors/ApplicationError';

interface PopulatedWhiteboardUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export interface WhiteboardProps {
    team: string;
    createdBy: string;
    title: string;
    folder: string | null;
    storageClusterId?: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: string | PopulatedWhiteboardUser | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Whiteboard {
    readonly _id: string;
    props: WhiteboardProps;
}

export const createWhiteboard = (_id: string, props: WhiteboardProps): Whiteboard => ({
    _id,
    props
});

export const requireWhiteboardStorageClusterId = (whiteboardId: string, props: WhiteboardProps): string => {
    if (props.storageClusterId && props.storageClusterId.trim().length > 0) {
        return props.storageClusterId;
    }

    throw ApplicationError.conflict(
        'Whiteboard::StorageClusterRequired',
        `Whiteboard ${whiteboardId} does not have a storage cluster assigned`
    );
};

export default Whiteboard;

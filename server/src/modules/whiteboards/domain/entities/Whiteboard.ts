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

export default Whiteboard;

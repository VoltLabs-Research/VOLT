export interface Whiteboard {
    _id: string;
    title: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

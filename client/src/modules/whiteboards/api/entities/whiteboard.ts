export interface Whiteboard {
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

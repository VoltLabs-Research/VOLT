export interface WhiteboardProps {
    team: string;
    createdBy: string;
    title: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

export default class Whiteboard {
    constructor(
        public readonly _id: string,
        public props: WhiteboardProps
    ) {}

    get id(): string {
        return this._id;
    }
};

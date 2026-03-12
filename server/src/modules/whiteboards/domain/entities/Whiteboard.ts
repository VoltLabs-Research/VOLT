export interface PopulatedWhiteboardUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
};

export interface WhiteboardProps {
    team: string;
    createdBy: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: string | PopulatedWhiteboardUser | null;
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

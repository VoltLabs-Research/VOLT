export interface WhiteboardFolderProps {
    team: string;
    createdBy: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export default class WhiteboardFolder {
    constructor(
        public readonly _id: string,
        public props: WhiteboardFolderProps
    ) {}

    get id(): string {
        return this._id;
    }
};

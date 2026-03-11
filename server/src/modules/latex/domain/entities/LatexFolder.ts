export interface LatexFolderProps {
    team: string;
    createdBy: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export default class LatexFolder {
    constructor(
        public readonly _id: string,
        public props: LatexFolderProps
    ) {}

    get id(): string {
        return this._id;
    }
};

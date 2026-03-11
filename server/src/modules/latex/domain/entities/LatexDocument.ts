export interface LatexDocumentProps {
    team: string;
    title: string;
    content: string;
    createdBy: string;
    folder: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export default class LatexDocument {
    constructor(
        public readonly _id: string,
        public props: LatexDocumentProps
    ) {}

    get id(): string {
        return this._id;
    }
};

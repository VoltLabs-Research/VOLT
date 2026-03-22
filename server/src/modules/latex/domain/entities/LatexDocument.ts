export interface PopulatedLatexUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
};

export interface LatexDocumentProps {
    team: string;
    title: string;
    createdBy: string | PopulatedLatexUser;
    lastEditedBy?: string | PopulatedLatexUser | null;
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

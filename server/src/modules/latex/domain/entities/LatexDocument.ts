interface PopulatedLatexUser {
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

export interface LatexDocument {
    readonly _id: string;
    props: LatexDocumentProps;
};

export const createLatexDocument = (_id: string, props: LatexDocumentProps): LatexDocument => ({
    _id,
    props
});

export default LatexDocument;

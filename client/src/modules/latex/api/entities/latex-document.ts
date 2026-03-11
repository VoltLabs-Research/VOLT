export interface LatexDocument {
    _id: string;
    title: string;
    content: string;
    folder: string | null;
    createdAt: Date;
    updatedAt: Date;
};

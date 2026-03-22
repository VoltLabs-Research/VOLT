export interface LatexAssetProps {
    team: string;
    document: string;
    originalName: string;
    /** Relative path within the document's virtual file tree (e.g. `images/fig1.png`). */
    path: string;
    storageKey: string;
    url: string;
    mimetype: string;
    size: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
};

export default class LatexAsset {
    constructor(
        public readonly _id: string,
        public props: LatexAssetProps
    ) {}

    get id(): string {
        return this._id;
    }
};

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
}

export interface LatexAsset {
    readonly _id: string;
    props: LatexAssetProps;
}

export const createLatexAsset = (_id: string, props: LatexAssetProps): LatexAsset => ({
    _id,
    props
});

export default LatexAsset;

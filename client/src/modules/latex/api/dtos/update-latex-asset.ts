export interface UpdateLatexAssetParams {
    documentId: string;
    assetId: string;
    /** New virtual path for the asset, e.g. `"images/fig1.png"`. */
    path: string;
}

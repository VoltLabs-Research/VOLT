import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type LatexFolderProps = CatalogFolderProps;

export interface LatexFolder {
    readonly _id: string;
    props: LatexFolderProps;
};

export const createLatexFolder = (_id: string, props: LatexFolderProps): LatexFolder => ({
    _id,
    props
});

export default LatexFolder;

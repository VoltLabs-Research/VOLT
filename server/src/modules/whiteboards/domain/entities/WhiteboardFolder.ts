import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type WhiteboardFolderProps = CatalogFolderProps;

export interface WhiteboardFolder {
    readonly _id: string;
    props: WhiteboardFolderProps;
};

export const createWhiteboardFolder = (_id: string, props: WhiteboardFolderProps): WhiteboardFolder => ({
    _id,
    props
});

export default WhiteboardFolder;

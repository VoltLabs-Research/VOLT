import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type ContainerFolderProps = CatalogFolderProps;

export interface ContainerFolder {
    readonly _id: string;
    props: ContainerFolderProps;
}

export const createContainerFolder = (_id: string, props: ContainerFolderProps): ContainerFolder => ({
    _id,
    props
});

export default ContainerFolder;

import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type ContainerFolderProps = CatalogFolderProps;

export default class ContainerFolder {
    constructor(
        public readonly _id: string,
        public props: ContainerFolderProps
    ) {}

    get id(): string {
        return this._id;
    }
}

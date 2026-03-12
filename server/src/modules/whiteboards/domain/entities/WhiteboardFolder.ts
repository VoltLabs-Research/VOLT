import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type WhiteboardFolderProps = CatalogFolderProps;

export default class WhiteboardFolder {
    constructor(
        public readonly _id: string,
        public props: WhiteboardFolderProps
    ) {}

    get id(): string {
        return this._id;
    }
};

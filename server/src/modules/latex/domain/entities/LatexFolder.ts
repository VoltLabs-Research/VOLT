import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type LatexFolderProps = CatalogFolderProps;

export default class LatexFolder {
    constructor(
        public readonly _id: string,
        public props: LatexFolderProps
    ) {}

    get id(): string {
        return this._id;
    }
};

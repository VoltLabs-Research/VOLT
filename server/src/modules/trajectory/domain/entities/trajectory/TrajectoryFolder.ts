import type { CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';

export type TrajectoryFolderProps = CatalogFolderProps;

export default class TrajectoryFolder {
    constructor(
        public readonly _id: string,
        public props: TrajectoryFolderProps
    ) {}

    get id(): string {
        return this._id;
    }
}

export interface CatalogFolderProps {
    team: string;
    createdBy: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export interface CatalogFolderEntity<TProps extends CatalogFolderProps = CatalogFolderProps> {
    readonly _id: string;
    props: TProps;
};

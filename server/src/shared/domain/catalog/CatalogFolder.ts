export enum CatalogFolderKind {
    Trajectory = 'trajectory',
    Container = 'container',
    Whiteboard = 'whiteboard',
    Latex = 'latex',
    Lammps = 'lammps'
}

export interface CatalogFolderProps {
    team: string;
    createdBy: string;
    title: string;
    parent: string | null;
    kind?: CatalogFolderKind;
    createdAt: Date;
    updatedAt: Date;
};

export interface CatalogFolderEntity<TProps extends CatalogFolderProps = CatalogFolderProps> {
    readonly _id: string;
    props: TProps;
};

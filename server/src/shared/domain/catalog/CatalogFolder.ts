export enum CatalogFolderKind {
    Trajectory = 'trajectory',
    Container = 'container',
    Whiteboard = 'whiteboard',
    Latex = 'latex'
}

interface CatalogFolderProps {
    team: string;
    createdBy: string;
    title: string;
    parent: string | null;
    kind?: CatalogFolderKind;
    createdAt: Date;
    updatedAt: Date;
}

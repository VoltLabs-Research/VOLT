export interface ActivityProps {
    type: ActivityType;
    createdAt: Date;
    description: string;
}

export interface DailyActivityProps {
    team: string;
    user: string;
    date: Date;
    activity: ActivityProps[];
    minutesOnline: number;
}

export enum ActivityType {
    TrajectoryUpload = 'trajectory-upload',
    TrajectoryDeletion = 'trajectory-deletion',
    AnalysisPerformed = 'analysis-performed',
    AnalysisDeletion = 'analysis-deletion',
    LatexDocumentCreation = 'latex-document-creation',
    LatexDocumentDeletion = 'latex-document-deletion',
    ContainerCreation = 'container-creation',
    ContainerDeletion = 'container-deletion',
    WhiteboardCreation = 'whiteboard-creation',
    WhiteboardDeletion = 'whiteboard-deletion',
    RoleCreation = 'role-creation',
    RoleDeletion = 'role-deletion',
    SecretKeyCreation = 'secret-key-creation',
    SecretKeyDeletion = 'secret-key-deletion'
}

export interface DailyActivity {
    _id: string;
    props: DailyActivityProps;
}

export const createDailyActivity = (_id: string, props: DailyActivityProps): DailyActivity => ({
    _id,
    props
});

export default DailyActivity;

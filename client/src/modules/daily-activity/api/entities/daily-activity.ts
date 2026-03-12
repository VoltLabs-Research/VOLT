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
};

export interface ActivityItem {
    type: ActivityType;
    createdAt: string;
    description: string;
};

export interface PopulatedUser {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
};

export interface DailyActivity {
    _id: string;
    team: string;
    user: string | PopulatedUser;
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
};

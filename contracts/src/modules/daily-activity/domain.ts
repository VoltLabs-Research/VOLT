export enum ActivityType{
    TrajectoryUpload = 'trajectory-upload',
    TrajectoryDeletion = 'trajectory-deletion',
    AnalysisPerformed = 'analysis-performed',
    AnalysisDeletion = 'analysis-deletion',
    ContainerCreation = 'container-creation',
    ContainerDeletion = 'container-deletion',
    WhiteboardCreation = 'whiteboard-creation',
    WhiteboardDeletion = 'whiteboard-deletion',
    RoleCreation = 'role-creation',
    RoleDeletion = 'role-deletion',
    SecretKeyCreation = 'secret-key-creation',
    SecretKeyDeletion = 'secret-key-deletion'
}

export interface DailyActivityUserSummary{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
}

export interface ActivityItem{
    type: ActivityType;
    description: string;
    createdAt: string;
}

export interface DailyActivity{
    _id: string;
    team: string;
    user: string | DailyActivityUserSummary;
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
}

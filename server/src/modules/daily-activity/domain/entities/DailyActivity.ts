export enum ActivityType{
    TrajectoryUpload = 'trajectory-upload',
    TrajectoryDeletion = 'trajectory-deletion',
    AnalysisPerformed = 'analysis-performed'
};

export interface ActivityProps{
    type: ActivityType;
    createdAt: Date;
    description: string;
};

export interface DailyActivityProps{
    team: string;
    user: string;
    date: Date;
    activity: ActivityProps[];
    minutesOnline: number;
};

export default class DailyActivity{
    constructor(
        public id: string,
        public props: DailyActivityProps
    ){}
};
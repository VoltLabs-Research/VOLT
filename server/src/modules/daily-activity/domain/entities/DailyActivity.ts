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

export interface PopulatedUser{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
};

export interface DailyActivityProps{
    team: string;
    user: string | PopulatedUser;
    date: Date;
    activity: ActivityProps[];
    minutesOnline: number;
};

export default class DailyActivity{
    constructor(
        public _id: string,
        public props: DailyActivityProps
    ){}
};

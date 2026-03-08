export interface ActivityProps {
    type: ActivityType;
    createdAt: Date;
    description: string;
};

export interface DailyActivityProps {
    team: string;
    user: string;
    date: Date;
    activity: ActivityProps[];
    minutesOnline: number;
};

export enum ActivityType {
    TrajectoryUpload = 'trajectory-upload',
    TrajectoryDeletion = 'trajectory-deletion',
    AnalysisPerformed = 'analysis-performed'
};

export default class DailyActivity {
    constructor(
        public _id: string,
        public props: DailyActivityProps
    ) {}
};



export interface DailyActivityUserSummary{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
}

export interface DailyActivityEntry{
    type: string;
    description: string;
    createdAt: string;
}

export interface DailyActivityRecord{
    _id: string;
    team: string;
    user: string | DailyActivityUserSummary;
    date: string;
    activity: DailyActivityEntry[];
    minutesOnline: number;
}

// Wire response types for the daily-activity module — the shapes the client
// reads back from `data`. Dates are ISO strings on the wire.

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

/** One team member's activity for a single day. */
export interface DailyActivityRecord{
    _id: string;
    team: string;
    user: string | DailyActivityUserSummary;
    date: string;
    activity: DailyActivityEntry[];
    minutesOnline: number;
}

import { MoreThanOrEqual } from 'typeorm';
import type { ActivityType } from '@volt/contracts/modules/daily-activity/domain';
import DailyActivity from '@modules/daily-activity/models/DailyActivity';
import type User from '@modules/auth/models/User';

interface GetTeamActivitySummaryInput {
    teamId: string;
    range?: number;
    userId?: string;
}

const startOfToday = (): Date => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const toActivityUser = (user: User | null | undefined) => {
    if(!user){
        return String(user);
    }

    return {
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar ?? undefined
    };
};

export default class DailyActivityService{
    async getTeamActivitySummary(input: GetTeamActivitySummaryInput){
        const range = input.range && input.range > 0 && Number.isFinite(input.range) ? Math.floor(input.range) : 7;
        const startDate = startOfToday();
        startDate.setDate(startDate.getDate() - range);

        const activities = await DailyActivity.find({
            where: {
                team: input.teamId,
                ...(input.userId ? { user: input.userId } : {}),
                date: MoreThanOrEqual(startDate)
            },
            relations: { userRef: true },
            order: { date: 'ASC' }
        });

        return {
            range,
            records: activities.map((activity) => ({
                _id: activity.id,
                team: activity.team,
                user: toActivityUser(activity.userRef),
                date: activity.date,
                activity: activity.activity ?? [],
                minutesOnline: activity.minutesOnline
            }))
        };
    }

    async recordActivity(teamId: string, userId: string, type: ActivityType, description: string): Promise<void>{
        const date = startOfToday();
        const entry = {
            type,
            description,
            createdAt: new Date()
        };

        const existing = await DailyActivity.findOneBy({
            team: teamId,
            user: userId,
            date
        });

        if(!existing){
            await DailyActivity.create({
                team: teamId,
                user: userId,
                date,
                activity: [entry],
                minutesOnline: 0
            }).save();
            return;
        }

        await Object.assign(existing, { activity: [...(existing.activity ?? []), entry] }).save();
    }

    async recordOnlineMinutes(teamId: string, userId: string, durationInMinutes: number): Promise<void>{
        const target = {
            team: teamId,
            user: userId,
            date: startOfToday()
        };

        if(await DailyActivity.existsBy(target)){
            await DailyActivity.getRepository().increment(target, 'minutesOnline', durationInMinutes);
            return;
        }

        await DailyActivity.create({
            ...target,
            activity: [],
            minutesOnline: durationInMinutes
        }).save();
    }
}

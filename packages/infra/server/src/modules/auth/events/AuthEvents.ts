import { Like } from 'typeorm';
import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import User from '@modules/auth/models/User';

@DefineEventGroup('auth')
export default class AuthEvents{
    @Event('team.deleted')
    async detachDeletedTeamFromUsers({ teamId }: EventMap['team.deleted']){
        const candidates = await User.findBy({ teams: Like(`%${teamId}%`) });

        for(const user of candidates){
            const teams = user.teams ?? [];
            if(!teams.includes(teamId)) continue;
            await Object.assign(user, { teams: teams.filter((team) => team !== teamId) }).save();
        }
    }
}

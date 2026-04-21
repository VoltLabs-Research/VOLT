import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { createListByController } from '@shared/infrastructure/http/controllers/createReadController';
import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';

const ListTeamRolesByTeamIdController = createListByController({
    repositoryToken: TEAM_TOKENS.TeamRoleRepository,
    paginated: true,
    filterBuilder: (params) => {
        const filter: Partial<TeamRoleProps> = {
            team: params.teamId as string
        };
        return filter;
    }
});

export default ListTeamRolesByTeamIdController;

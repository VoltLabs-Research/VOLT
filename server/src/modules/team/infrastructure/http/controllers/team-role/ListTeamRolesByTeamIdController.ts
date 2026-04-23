import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import { createListByController } from '@shared/infrastructure/http/controllers/createReadController';

const ListTeamRolesByTeamIdController = createListByController({
    repositoryToken: TeamRoleRepository,
    paginated: true,
    filterBuilder: (params) => {
        const filter: Partial<TeamRoleProps> = {
            team: params.teamId as string
        };
        return filter;
    }
});

export default ListTeamRolesByTeamIdController;

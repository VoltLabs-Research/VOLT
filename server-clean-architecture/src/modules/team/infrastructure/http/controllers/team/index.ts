import CreateTeamController from './CreateTeamController';
import DeleteTeamByIdController from './DeleteTeamByIdController';
import GetTeamByIdController from './GetTeamByIdController';
import ListUserTeamsController from './ListUserTeamsController';
import RemoveUserFromTeamController from './RemoveUserFromTeamController';
import UpdateTeamByIdController from './UpdateTeamByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateTeamController),
    deleteById: container.resolve(DeleteTeamByIdController),
    getById: container.resolve(GetTeamByIdController),
    listUserTeams: container.resolve(ListUserTeamsController),
    removeUserFromTeam: container.resolve(RemoveUserFromTeamController),
    updateById: container.resolve(UpdateTeamByIdController)
};
import CreateTeamRoleController from './CreateTeamRoleController';
import DeleteTeamRoleByIdController from './DeleteTeamRoleByIdController';
import GetTeamRoleByIdController from './GetTeamRoleByIdController';
import ListTeamRolesByTeamIdController from './ListTeamRolesByTeamIdController';
import UpdateTeamRoleByIdController from './UpdateTeamRoleByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateTeamRoleController),
    deleteById: container.resolve(DeleteTeamRoleByIdController),
    getById: container.resolve(GetTeamRoleByIdController),
    listByTeamId: container.resolve(ListTeamRolesByTeamIdController),
    updateById: container.resolve(UpdateTeamRoleByIdController)
};
import CreateTeamMemberController from './CreateTeamMemberController';
import DeleteTeamMemberByIdController from './DeleteTeamMemberByIdController';
import GetTeamMemberByIdController from './GetTeamMemberByIdController';
import ListTeamMembersByTeamIdController from './ListTeamMembersByTeamIdController';
import UpdateTeamMemberByIdController from './UpdateTeamMemberByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateTeamMemberController),
    deleteById: container.resolve(DeleteTeamMemberByIdController),
    getById: container.resolve(GetTeamMemberByIdController),
    listByTeamId: container.resolve(ListTeamMembersByTeamIdController),
    updateById: container.resolve(UpdateTeamMemberByIdController)
};
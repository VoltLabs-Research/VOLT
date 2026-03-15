import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase';

const DeleteTeamMemberByIdController = createController(DeleteTeamMemberByIdUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (_request, params) => ({
        ...params,
        teamMemberId: params.memberId
    })
});

export default DeleteTeamMemberByIdController;

import { ErrorCodes } from '@core/constants/error-codes';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetTeamMemberByIdController = createGetByIdController({
    repositoryToken: TeamMemberRepository,
    paramKey: 'teamMemberId',
    notFoundCode: ErrorCodes.TEAM_MEMBER_NOT_FOUND,
    notFoundMessage: 'TeamMember not found'
});

export default GetTeamMemberByIdController;

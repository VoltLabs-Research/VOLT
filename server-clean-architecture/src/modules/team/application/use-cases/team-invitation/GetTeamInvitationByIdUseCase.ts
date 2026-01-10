import { Result } from '@/src/shared/domain/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { GetTeamInvitationByIdInputDTO, GetTeamInvitationByIdOutputDTO } from '../../dtos/team-invitation/GetTeamInvitationByIdDTO';

@injectable()
export default class GetTeamInvitationByIdUseCase implements IUseCase<GetTeamInvitationByIdInputDTO, GetTeamInvitationByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private invitationRepository: ITeamInvitationRepository
    ){}

    async execute(input: GetTeamInvitationByIdInputDTO): Promise<Result<GetTeamInvitationByIdOutputDTO, ApplicationError>> {
        const { invitationId } = input;
        const invitation = await this.invitationRepository.findById(invitationId);
        if(!invitation){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Team invitation not found'
            ));
        }
        return Result.ok(invitation.props);
    }
};
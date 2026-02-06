import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import { UpdateTeamInvitationByIdInputDTO, UpdateTeamInvitationByIdOutputDTO } from '@modules/team/application/dtos/team-invitation/UpdateTeamInvitationByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class UpdateTeamInvitationByIdUseCase implements IUseCase<UpdateTeamInvitationByIdInputDTO, UpdateTeamInvitationByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private invitationRepo: ITeamInvitationRepository
    ){}
    
    async execute(input: UpdateTeamInvitationByIdInputDTO): Promise<Result<UpdateTeamInvitationByIdOutputDTO, ApplicationError>>{
        const { invitationId, status } = input;
        const invitation = await this.invitationRepo.updateById(invitationId, { status });
        if(!invitation){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Team invitation not found'
            ));
        }

        return Result.ok(invitation.props);
    }
};
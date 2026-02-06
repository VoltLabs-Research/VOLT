import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import { DeleteTeamInvitationByIdInputDTO } from '@modules/team/application/dtos/team-invitation/DeleteTeamInvitationByIdDTO';

@injectable()
export default class DeleteTeamInvitationByIdUseCase implements IUseCase<DeleteTeamInvitationByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private invitationRepo: ITeamInvitationRepository
    ){}

    async execute(input: DeleteTeamInvitationByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { invitationId } = input;
        const result = await this.invitationRepo.deleteById(invitationId);
        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Team invitation not found'
            ));
        }

        return Result.ok(null);
    }

};
import { Result } from '@/src/shared/domain/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { DeleteTeamInvitationByIdInputDTO } from '../../dtos/team-invitation/DeleteTeamInvitationByIdDTO';

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
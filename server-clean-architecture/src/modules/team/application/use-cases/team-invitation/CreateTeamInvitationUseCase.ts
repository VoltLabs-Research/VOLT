import { Result } from '@/src/shared/domain/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { CreateTeamInvitationInputDTO, CreateTeamInvitationOutputDTO } from '../../dtos/team-invitation/CreateTeamInvitationDTO';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { TeamInvitationStatus } from '../../../domain/entities/TeamInvitation';

@injectable()
export default class CreateTeamInvitationUseCase implements IUseCase<CreateTeamInvitationInputDTO, CreateTeamInvitationOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private invitationRepository: ITeamInvitationRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}

    async execute(input: CreateTeamInvitationInputDTO): Promise<Result<CreateTeamInvitationOutputDTO, ApplicationError>>{
        const { teamId, invitedBy, invitedUser, email, role } = input;
        
        const team = await this.teamRepository.findById(teamId);
        if(!team){
            return Result.fail(new ApplicationError(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const alreadyInvited = await this.invitationRepository.findOne({ email, team: teamId });
        if(alreadyInvited && !alreadyInvited.isExpired()){
            return Result.fail(new ApplicationError(
                ErrorCodes.TEAM_INVITATION_ALREADY_SENT,
                'Team invitation already sent'
            ));
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await this.invitationRepository.create({
            email,
            invitedBy,
            role,
            expiresAt,
            invitedUser,
            status: TeamInvitationStatus.Pending
        });

        return Result.ok(invitation.props);
    }
}
import AcceptTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/AcceptTeamInvitationUseCase';
import DeleteTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/DeleteTeamInvitationByIdUseCase';
import RejectTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/RejectTeamInvitationUseCase';
import SendTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/SendTeamInvitationUseCase';
import UpdateTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/UpdateTeamInvitationByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the team-invitation resource. Thin
 * delegators to retained use cases, returning each use case's value and letting a thrown
 * `ApplicationError` reach the global `httpErrorMiddleware`. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.TeamInvitationHttpService)
export default class TeamInvitationHttpService {
    constructor(
        @inject(AcceptTeamInvitationUseCase) private readonly acceptTeamInvitationUseCase: AcceptTeamInvitationUseCase,
        @inject(DeleteTeamInvitationByIdUseCase) private readonly deleteTeamInvitationByIdUseCase: DeleteTeamInvitationByIdUseCase,
        @inject(RejectTeamInvitationUseCase) private readonly rejectTeamInvitationUseCase: RejectTeamInvitationUseCase,
        @inject(SendTeamInvitationUseCase) private readonly sendTeamInvitationUseCase: SendTeamInvitationUseCase,
        @inject(UpdateTeamInvitationByIdUseCase) private readonly updateTeamInvitationByIdUseCase: UpdateTeamInvitationByIdUseCase
    ) {}

    send(
        input: UseCaseInput<SendTeamInvitationUseCase>
    ): Promise<UseCaseOutput<SendTeamInvitationUseCase>> {
        return this.sendTeamInvitationUseCase.execute(input);
    }

    deleteById(
        input: UseCaseInput<DeleteTeamInvitationByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamInvitationByIdUseCase>> {
        return this.deleteTeamInvitationByIdUseCase.execute(input);
    }

    updateById(
        input: UseCaseInput<UpdateTeamInvitationByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamInvitationByIdUseCase>> {
        return this.updateTeamInvitationByIdUseCase.execute(input);
    }

    accept(
        input: UseCaseInput<AcceptTeamInvitationUseCase>
    ): Promise<UseCaseOutput<AcceptTeamInvitationUseCase>> {
        return this.acceptTeamInvitationUseCase.execute(input);
    }

    reject(
        input: UseCaseInput<RejectTeamInvitationUseCase>
    ): Promise<UseCaseOutput<RejectTeamInvitationUseCase>> {
        return this.rejectTeamInvitationUseCase.execute(input);
    }
}

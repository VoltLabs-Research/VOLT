import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type {
    CreateTeamUseCase,
    UpdateTeamUseCase,
    DeleteTeamUseCase,
    GetAllTeamsUseCase,
    LeaveTeamUseCase,
    CanInviteUseCase
} from '@/modules/team/application/use-cases/team';

const useTeamUseCases = createUseCasesHook({
    createTeamUseCase: TEAM_TOKENS.CreateTeamUseCase,
    updateTeamUseCase: TEAM_TOKENS.UpdateTeamUseCase,
    deleteTeamUseCase: TEAM_TOKENS.DeleteTeamUseCase,
    getAllTeamsUseCase: TEAM_TOKENS.GetAllTeamsUseCase,
    leaveTeamUseCase: TEAM_TOKENS.LeaveTeamUseCase,
    canInviteUseCase: TEAM_TOKENS.CanInviteUseCase
}) as () => {
    createTeamUseCase: CreateTeamUseCase;
    updateTeamUseCase: UpdateTeamUseCase;
    deleteTeamUseCase: DeleteTeamUseCase;
    getAllTeamsUseCase: GetAllTeamsUseCase;
    leaveTeamUseCase: LeaveTeamUseCase;
    canInviteUseCase: CanInviteUseCase;
};

export default useTeamUseCases;

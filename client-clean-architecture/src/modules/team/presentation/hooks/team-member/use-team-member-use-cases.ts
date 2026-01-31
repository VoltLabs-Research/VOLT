import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type {
    GetAllTeamMembersUseCase,
    UpdateTeamMemberUseCase,
    RemoveTeamMemberUseCase
} from '@/modules/team/application/use-cases/team-member';

const useTeamMemberUseCases = createUseCasesHook({
    getAllTeamMembersUseCase: TEAM_TOKENS.GetAllTeamMembersUseCase,
    updateTeamMemberUseCase: TEAM_TOKENS.UpdateTeamMemberUseCase,
    removeTeamMemberUseCase: TEAM_TOKENS.RemoveTeamMemberUseCase
}) as () => {
    getAllTeamMembersUseCase: GetAllTeamMembersUseCase;
    updateTeamMemberUseCase: UpdateTeamMemberUseCase;
    removeTeamMemberUseCase: RemoveTeamMemberUseCase;
};

export default useTeamMemberUseCases;

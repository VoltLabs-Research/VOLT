import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type {
    CreateTeamRoleUseCase,
    UpdateTeamRoleUseCase,
    DeleteTeamRoleUseCase,
    GetAllTeamRolesUseCase
} from '@/modules/team/application/use-cases/team-role';

const useTeamRoleUseCases = createUseCasesHook({
    createTeamRoleUseCase: TEAM_TOKENS.CreateTeamRoleUseCase,
    updateTeamRoleUseCase: TEAM_TOKENS.UpdateTeamRoleUseCase,
    deleteTeamRoleUseCase: TEAM_TOKENS.DeleteTeamRoleUseCase,
    getAllTeamRolesUseCase: TEAM_TOKENS.GetAllTeamRolesUseCase
}) as () => {
    createTeamRoleUseCase: CreateTeamRoleUseCase;
    updateTeamRoleUseCase: UpdateTeamRoleUseCase;
    deleteTeamRoleUseCase: DeleteTeamRoleUseCase;
    getAllTeamRolesUseCase: GetAllTeamRolesUseCase;
};

export default useTeamRoleUseCases;

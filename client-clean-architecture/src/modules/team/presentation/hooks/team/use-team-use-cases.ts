import { useMemo } from 'react';
import { container } from 'tsyringe';
import {
    CreateTeamUseCase,
    UpdateTeamUseCase,
    DeleteTeamUseCase,
    GetAllTeamsUseCase,
    LeaveTeamUseCase,
    CanInviteUseCase
} from '@/modules/team/application/use-cases/team';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';

const useTeamUseCases = () => {
    const createTeamUseCase = useMemo(() => {
        return container.resolve<CreateTeamUseCase>(TEAM_TOKENS.CreateTeamUseCase);
    }, []);

    const updateTeamUseCase = useMemo(() => {
        return container.resolve<UpdateTeamUseCase>(TEAM_TOKENS.UpdateTeamUseCase);
    }, []);

    const deleteTeamUseCase = useMemo(() => {
        return container.resolve<DeleteTeamUseCase>(TEAM_TOKENS.DeleteTeamUseCase);
    }, []);

    const getAllTeamsUseCase = useMemo(() => {
        return container.resolve<GetAllTeamsUseCase>(TEAM_TOKENS.GetAllTeamsUseCase);
    }, []);

    const leaveTeamUseCase = useMemo(() => {
        return container.resolve<LeaveTeamUseCase>(TEAM_TOKENS.LeaveTeamUseCase);
    }, []);

    const canInviteUseCase = useMemo(() => {
        return container.resolve<CanInviteUseCase>(TEAM_TOKENS.CanInviteUseCase);
    }, []);

    return {
        createTeamUseCase,
        updateTeamUseCase,
        deleteTeamUseCase,
        getAllTeamsUseCase,
        leaveTeamUseCase,
        canInviteUseCase
    };
};

export default useTeamUseCases;

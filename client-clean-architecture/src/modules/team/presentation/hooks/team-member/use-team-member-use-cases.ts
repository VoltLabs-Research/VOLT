import { useMemo } from 'react';
import { container } from 'tsyringe';
import {
    GetAllTeamMembersUseCase,
    UpdateTeamMemberUseCase,
    RemoveTeamMemberUseCase
} from '@/modules/team/application/use-cases/team-member';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';

const useTeamMemberUseCases = () => {
    const getAllTeamMembersUseCase = useMemo(() => {
        return container.resolve<GetAllTeamMembersUseCase>(TEAM_TOKENS.GetAllTeamMembersUseCase);
    }, []);

    const updateTeamMemberUseCase = useMemo(() => {
        return container.resolve<UpdateTeamMemberUseCase>(TEAM_TOKENS.UpdateTeamMemberUseCase);
    }, []);

    const removeTeamMemberUseCase = useMemo(() => {
        return container.resolve<RemoveTeamMemberUseCase>(TEAM_TOKENS.RemoveTeamMemberUseCase);
    }, []);

    return {
        getAllTeamMembersUseCase,
        updateTeamMemberUseCase,
        removeTeamMemberUseCase
    };
};

export default useTeamMemberUseCases;

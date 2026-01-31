import { useMemo } from 'react';
import { container } from 'tsyringe';
import {
    CreateTeamRoleUseCase,
    UpdateTeamRoleUseCase,
    DeleteTeamRoleUseCase,
    GetAllTeamRolesUseCase
} from '@/modules/team/application/use-cases/team-role';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';

const useTeamRoleUseCases = () => {
    const createTeamRoleUseCase = useMemo(() => {
        return container.resolve<CreateTeamRoleUseCase>(TEAM_TOKENS.CreateTeamRoleUseCase);
    }, []);

    const updateTeamRoleUseCase = useMemo(() => {
        return container.resolve<UpdateTeamRoleUseCase>(TEAM_TOKENS.UpdateTeamRoleUseCase);
    }, []);

    const deleteTeamRoleUseCase = useMemo(() => {
        return container.resolve<DeleteTeamRoleUseCase>(TEAM_TOKENS.DeleteTeamRoleUseCase);
    }, []);

    const getAllTeamRolesUseCase = useMemo(() => {
        return container.resolve<GetAllTeamRolesUseCase>(TEAM_TOKENS.GetAllTeamRolesUseCase);
    }, []);

    return {
        createTeamRoleUseCase,
        updateTeamRoleUseCase,
        deleteTeamRoleUseCase,
        getAllTeamRolesUseCase
    };
};

export default useTeamRoleUseCases;

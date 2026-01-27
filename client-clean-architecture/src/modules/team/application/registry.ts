import type { ITeamRepository } from '../domain/repositories/ITeamRepository';
import type { ITeamMemberRepository } from '../domain/repositories/ITeamMemberRepository';
import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import {
    CreateTeamUseCase,
    DeleteTeamUseCase,
    GetTeamMembersUseCase,
    GetUserTeamsUseCase,
    InitializeTeamPresenceSocketUseCase,
    LeaveTeamUseCase,
    RemoveTeamMemberUseCase,
    SubscribeToTeamSocketUseCase,
    UpdateTeamUseCase
} from './use-cases';

export interface TeamDependencies {
    teamRepository: ITeamRepository;
    teamMemberRepository: ITeamMemberRepository;
    socketService: ISocketService;
}

export interface TeamUseCases {
    getUserTeamsUseCase: GetUserTeamsUseCase;
    createTeamUseCase: CreateTeamUseCase;
    updateTeamUseCase: UpdateTeamUseCase;
    deleteTeamUseCase: DeleteTeamUseCase;
    leaveTeamUseCase: LeaveTeamUseCase;
    getTeamMembersUseCase: GetTeamMembersUseCase;
    removeTeamMemberUseCase: RemoveTeamMemberUseCase;
    subscribeToTeamSocketUseCase: SubscribeToTeamSocketUseCase;
    initializeTeamPresenceSocketUseCase: InitializeTeamPresenceSocketUseCase;
}

let dependencies: TeamDependencies | null = null;
let useCases: TeamUseCases | null = null;

const buildUseCases = (deps: TeamDependencies): TeamUseCases => ({
    getUserTeamsUseCase: new GetUserTeamsUseCase(deps.teamRepository),
    createTeamUseCase: new CreateTeamUseCase(deps.teamRepository),
    updateTeamUseCase: new UpdateTeamUseCase(deps.teamRepository),
    deleteTeamUseCase: new DeleteTeamUseCase(deps.teamRepository),
    leaveTeamUseCase: new LeaveTeamUseCase(deps.teamRepository),
    getTeamMembersUseCase: new GetTeamMembersUseCase(deps.teamMemberRepository),
    removeTeamMemberUseCase: new RemoveTeamMemberUseCase(deps.teamRepository),
    subscribeToTeamSocketUseCase: new SubscribeToTeamSocketUseCase(deps.socketService),
    initializeTeamPresenceSocketUseCase: new InitializeTeamPresenceSocketUseCase(deps.socketService)
});

export const registerTeamDependencies = (deps: TeamDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getTeamUseCases = (): TeamUseCases => {
    if (!dependencies) {
        throw new Error('Team dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};

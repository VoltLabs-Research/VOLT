import CheckInvitePermissionUseCase from '@modules/team/application/use-cases/team/CheckInvitePermissionUseCase';
import CreateTeamUseCase from '@modules/team/application/use-cases/team/CreateTeamUseCase';
import DeleteTeamByIdUseCase from '@modules/team/application/use-cases/team/DeleteTeamByIdUseCase';
import DeleteTeamInviteCodeUseCase from '@modules/team/application/use-cases/team/DeleteTeamInviteCodeUseCase';
import GenerateTeamInviteCodeUseCase from '@modules/team/application/use-cases/team/GenerateTeamInviteCodeUseCase';
import GetMyTeamPermissionsUseCase from '@modules/team/application/use-cases/team/GetMyTeamPermissionsUseCase';
import GetTeamByIdUseCase from '@modules/team/application/use-cases/team/GetTeamByIdUseCase';
import JoinTeamByInviteCodeUseCase from '@modules/team/application/use-cases/team/JoinTeamByInviteCodeUseCase';
import LeaveTeamUseCase from '@modules/team/application/use-cases/team/LeaveTeamUseCase';
import ListUserTeamsUseCase from '@modules/team/application/use-cases/team/ListUserTeamsUseCase';
import PreviewJoinTeamByInviteCodeUseCase from '@modules/team/application/use-cases/team/PreviewJoinTeamByInviteCodeUseCase';
import SetDefaultTeamForNewUsersUseCase from '@modules/team/application/use-cases/team/SetDefaultTeamForNewUsersUseCase';
import UpdateTeamByIdUseCase from '@modules/team/application/use-cases/team/UpdateTeamByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single HTTP-facing application service for the team resource. Every
 * method is a thin delegator to a retained use case: it runs the use case and
 * returns its value, letting any thrown `ApplicationError` propagate so Express 5
 * forwards it to the global `httpErrorMiddleware`.
 *
 * No orchestration logic lives here — the use cases remain the single source of
 * truth and are still consumed directly by the team AI tools, event handlers,
 * socket modules and cross-module contract ports. This facade exists only to
 * give the {@link TeamController} a typed surface to call.
 */
@Singleton(TEAM_TOKENS.TeamHttpService)
export default class TeamHttpService {
    constructor(
        @inject(CheckInvitePermissionUseCase) private readonly checkInvitePermissionUseCase: CheckInvitePermissionUseCase,
        @inject(CreateTeamUseCase) private readonly createTeamUseCase: CreateTeamUseCase,
        @inject(DeleteTeamByIdUseCase) private readonly deleteTeamByIdUseCase: DeleteTeamByIdUseCase,
        @inject(DeleteTeamInviteCodeUseCase) private readonly deleteTeamInviteCodeUseCase: DeleteTeamInviteCodeUseCase,
        @inject(GenerateTeamInviteCodeUseCase) private readonly generateTeamInviteCodeUseCase: GenerateTeamInviteCodeUseCase,
        @inject(GetMyTeamPermissionsUseCase) private readonly getMyTeamPermissionsUseCase: GetMyTeamPermissionsUseCase,
        @inject(GetTeamByIdUseCase) private readonly getTeamByIdUseCase: GetTeamByIdUseCase,
        @inject(JoinTeamByInviteCodeUseCase) private readonly joinTeamByInviteCodeUseCase: JoinTeamByInviteCodeUseCase,
        @inject(LeaveTeamUseCase) private readonly leaveTeamUseCase: LeaveTeamUseCase,
        @inject(ListUserTeamsUseCase) private readonly listUserTeamsUseCase: ListUserTeamsUseCase,
        @inject(PreviewJoinTeamByInviteCodeUseCase) private readonly previewJoinTeamByInviteCodeUseCase: PreviewJoinTeamByInviteCodeUseCase,
        @inject(SetDefaultTeamForNewUsersUseCase) private readonly setDefaultTeamForNewUsersUseCase: SetDefaultTeamForNewUsersUseCase,
        @inject(UpdateTeamByIdUseCase) private readonly updateTeamByIdUseCase: UpdateTeamByIdUseCase
    ) {}

    create(
        input: UseCaseInput<CreateTeamUseCase>
    ): Promise<UseCaseOutput<CreateTeamUseCase>> {
        return this.createTeamUseCase.execute(input);
    }

    deleteById(
        input: UseCaseInput<DeleteTeamByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamByIdUseCase>> {
        return this.deleteTeamByIdUseCase.execute(input);
    }

    deleteInviteCode(
        input: UseCaseInput<DeleteTeamInviteCodeUseCase>
    ): Promise<UseCaseOutput<DeleteTeamInviteCodeUseCase>> {
        return this.deleteTeamInviteCodeUseCase.execute(input);
    }

    generateInviteCode(
        input: UseCaseInput<GenerateTeamInviteCodeUseCase>
    ): Promise<UseCaseOutput<GenerateTeamInviteCodeUseCase>> {
        return this.generateTeamInviteCodeUseCase.execute(input);
    }

    getById(
        input: UseCaseInput<GetTeamByIdUseCase>
    ): Promise<UseCaseOutput<GetTeamByIdUseCase>> {
        return this.getTeamByIdUseCase.execute(input);
    }

    getMyPermissions(
        input: UseCaseInput<GetMyTeamPermissionsUseCase>
    ): Promise<UseCaseOutput<GetMyTeamPermissionsUseCase>> {
        return this.getMyTeamPermissionsUseCase.execute(input);
    }

    joinByCode(
        input: UseCaseInput<JoinTeamByInviteCodeUseCase>
    ): Promise<UseCaseOutput<JoinTeamByInviteCodeUseCase>> {
        return this.joinTeamByInviteCodeUseCase.execute(input);
    }

    leave(
        input: UseCaseInput<LeaveTeamUseCase>
    ): Promise<UseCaseOutput<LeaveTeamUseCase>> {
        return this.leaveTeamUseCase.execute(input);
    }

    listUserTeams(
        input: UseCaseInput<ListUserTeamsUseCase>
    ): Promise<UseCaseOutput<ListUserTeamsUseCase>> {
        return this.listUserTeamsUseCase.execute(input);
    }

    previewJoinByCode(
        input: UseCaseInput<PreviewJoinTeamByInviteCodeUseCase>
    ): Promise<UseCaseOutput<PreviewJoinTeamByInviteCodeUseCase>> {
        return this.previewJoinTeamByInviteCodeUseCase.execute(input);
    }

    setDefaultForNewUsers(
        input: UseCaseInput<SetDefaultTeamForNewUsersUseCase>
    ): Promise<UseCaseOutput<SetDefaultTeamForNewUsersUseCase>> {
        return this.setDefaultTeamForNewUsersUseCase.execute(input);
    }

    updateById(
        input: UseCaseInput<UpdateTeamByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamByIdUseCase>> {
        return this.updateTeamByIdUseCase.execute(input);
    }

    checkInvitePermission(
        input: UseCaseInput<CheckInvitePermissionUseCase>
    ): Promise<UseCaseOutput<CheckInvitePermissionUseCase>> {
        return this.checkInvitePermissionUseCase.execute(input);
    }
}

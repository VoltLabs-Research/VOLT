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
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single HTTP-facing application service for the team resource. Every
 * method is a thin delegator to a retained use case: it runs the use case and
 * unwraps the `Result` onto the thrown-error channel so Express 5 forwards any
 * failure to the global `httpErrorMiddleware` (equivalent, byte-for-byte, to the
 * generated controllers' `BaseResponse.fromError` path).
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

    /**
     * Awaits a use-case execution and unwraps the `Result`, throwing the
     * `ApplicationError` on failure so it reaches `httpErrorMiddleware`.
     */
    private async run<T, E = ApplicationError>(execution: Promise<Result<T, E>>): Promise<T> {
        const result = await execution;
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    create(
        input: UseCaseInput<CreateTeamUseCase>
    ): Promise<UseCaseOutput<CreateTeamUseCase>> {
        return this.run(this.createTeamUseCase.execute(input));
    }

    deleteById(
        input: UseCaseInput<DeleteTeamByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamByIdUseCase>> {
        return this.run(this.deleteTeamByIdUseCase.execute(input));
    }

    deleteInviteCode(
        input: UseCaseInput<DeleteTeamInviteCodeUseCase>
    ): Promise<UseCaseOutput<DeleteTeamInviteCodeUseCase>> {
        return this.run(this.deleteTeamInviteCodeUseCase.execute(input));
    }

    generateInviteCode(
        input: UseCaseInput<GenerateTeamInviteCodeUseCase>
    ): Promise<UseCaseOutput<GenerateTeamInviteCodeUseCase>> {
        return this.run(this.generateTeamInviteCodeUseCase.execute(input));
    }

    getById(
        input: UseCaseInput<GetTeamByIdUseCase>
    ): Promise<UseCaseOutput<GetTeamByIdUseCase>> {
        return this.run(this.getTeamByIdUseCase.execute(input));
    }

    getMyPermissions(
        input: UseCaseInput<GetMyTeamPermissionsUseCase>
    ): Promise<UseCaseOutput<GetMyTeamPermissionsUseCase>> {
        return this.run(this.getMyTeamPermissionsUseCase.execute(input));
    }

    joinByCode(
        input: UseCaseInput<JoinTeamByInviteCodeUseCase>
    ): Promise<UseCaseOutput<JoinTeamByInviteCodeUseCase>> {
        return this.run(this.joinTeamByInviteCodeUseCase.execute(input));
    }

    leave(
        input: UseCaseInput<LeaveTeamUseCase>
    ): Promise<UseCaseOutput<LeaveTeamUseCase>> {
        return this.run(this.leaveTeamUseCase.execute(input));
    }

    listUserTeams(
        input: UseCaseInput<ListUserTeamsUseCase>
    ): Promise<UseCaseOutput<ListUserTeamsUseCase>> {
        return this.run(this.listUserTeamsUseCase.execute(input));
    }

    previewJoinByCode(
        input: UseCaseInput<PreviewJoinTeamByInviteCodeUseCase>
    ): Promise<UseCaseOutput<PreviewJoinTeamByInviteCodeUseCase>> {
        return this.run(this.previewJoinTeamByInviteCodeUseCase.execute(input));
    }

    setDefaultForNewUsers(
        input: UseCaseInput<SetDefaultTeamForNewUsersUseCase>
    ): Promise<UseCaseOutput<SetDefaultTeamForNewUsersUseCase>> {
        return this.run(this.setDefaultTeamForNewUsersUseCase.execute(input));
    }

    updateById(
        input: UseCaseInput<UpdateTeamByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamByIdUseCase>> {
        return this.run(this.updateTeamByIdUseCase.execute(input));
    }

    checkInvitePermission(
        input: UseCaseInput<CheckInvitePermissionUseCase>
    ): Promise<UseCaseOutput<CheckInvitePermissionUseCase>> {
        return this.run(this.checkInvitePermissionUseCase.execute(input));
    }
}

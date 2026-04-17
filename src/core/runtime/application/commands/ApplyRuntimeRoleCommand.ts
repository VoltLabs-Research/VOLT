import type { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';
import { BaseCommand } from '@/core/commands/BaseCommand';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import type { TeamClusterDaemonRoleApplyPayload } from '@/core/runtime/contracts/teamClusterRuntime';

export class ApplyRuntimeRoleCommand extends BaseCommand<TeamClusterDaemonRoleApplyPayload> {
    static readonly commandName = ChannelCommands.RuntimeRoleApply;

    constructor(
        payload: TeamClusterDaemonRoleApplyPayload,
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator
    ) {
        super(payload);
    }

    readonly execute = async () => {
        try {
            return {
                data: await this.runtimeRoleCoordinator.applyRoleConfig(this.payload.roleConfig)
            };
        } catch (error) {
            return {
                data: { accepted: false },
                error: error instanceof Error ? error.message : 'Failed to apply runtime role'
            };
        }
    };
}

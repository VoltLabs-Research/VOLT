import type { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';
import { BaseCommand } from '@/core/commands/BaseCommand';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import type { TeamClusterDaemonQueueConcurrencyApplyPayload } from '@/core/runtime/contracts/teamClusterRuntime';

export class ApplyRuntimeQueueConcurrencyCommand extends BaseCommand<TeamClusterDaemonQueueConcurrencyApplyPayload> {
    static readonly commandName = ChannelCommands.RuntimeQueueConcurrencyApply;

    constructor(
        payload: TeamClusterDaemonQueueConcurrencyApplyPayload,
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator
    ) {
        super(payload);
    }

    execute = () => {
        try {
            this.runtimeRoleCoordinator.applyQueueSettings(
                this.payload.queueConcurrency,
                this.payload.queueScopeLimits
            );
        } catch (error) {
            return {
                data: { accepted: false },
                error: error instanceof Error ? error.message : 'Failed to apply queue settings'
            };
        }

        return {
            data: {
                accepted: true,
                queueConcurrency: this.payload.queueConcurrency,
                queueScopeLimits: this.payload.queueScopeLimits
            }
        };
    }
}

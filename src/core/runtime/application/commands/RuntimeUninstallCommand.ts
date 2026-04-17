import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DaemonConfig } from '@/core/config';
import { BaseCommand } from '@/core/commands/BaseCommand';
import type { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';

const DEFERRED_RUNTIME_COMMAND_DELAY_MS = 250;

export class RuntimeUninstallCommand extends BaseCommand<undefined> {
    static readonly commandName = 'runtime.uninstall';

    constructor(
        payload: undefined,
        private readonly config: DaemonConfig,
        private readonly dockerRuntimeService: DockerRuntimeService,
        private readonly voltCloudConnection: VoltCloudConnection
    ) {
        super(payload);
    }

    execute() {
        const { config, dockerRuntimeService, voltCloudConnection } = this;

        this.voltCloudConnection.emitLifecycleEvent('uninstall-requested', 'Remote uninstall requested');

        setTimeout(async function runDeferredUninstall() {
            try {
                if (config.composeProjectName) {
                    await dockerRuntimeService.removeComposeProject(config.composeProjectName);
                }

                if (config.installRoot) {
                    await fs.rm(path.join(config.installRoot, config.teamClusterId), {
                        recursive: true,
                        force: true
                    });
                }

                process.exit(0);
            } catch (error) {
                const details = `Runtime uninstall failed: ${error.message}`;

                voltCloudConnection.emitLifecycleEvent('delete-failed', details);
                await voltCloudConnection.reportDeleteFailed(details);
                process.exit(1);
            }
        }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);

        return {
            data: { accepted: true }
        };
    }
}

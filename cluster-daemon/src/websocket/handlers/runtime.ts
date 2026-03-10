import type { DaemonConfig } from '../../core/config';
import type { DockerRuntimeService } from '../../infrastructure/docker/DockerRuntimeService';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';
import fs from 'node:fs/promises';
import path from 'node:path';

interface RuntimeHandlersDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
}

export const createRuntimeHandlers = (deps: RuntimeHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'runtime.uninstall',
        execute: async () => {
            deps.eventBroker.emitLifecycle({
                type: 'uninstall-requested',
                teamClusterId: deps.config.teamClusterId,
                timestamp: new Date().toISOString(),
                connectedToCloud: true,
                details: 'Remote uninstall requested'
            });

            setTimeout(async () => {
                try {
                    if (deps.config.composeProjectName) {
                        await deps.dockerRuntimeService.removeComposeProject(deps.config.composeProjectName);
                    }

                    if (deps.config.installRoot) {
                        const installDirectory = path.join(deps.config.installRoot, deps.config.teamClusterId);
                        await fs.rm(installDirectory, {
                            recursive: true,
                            force: true
                        });
                    }

                    process.exit(0);
                } catch {
                }
            }, 250);

            return { data: { accepted: true } };
        }
    }
];

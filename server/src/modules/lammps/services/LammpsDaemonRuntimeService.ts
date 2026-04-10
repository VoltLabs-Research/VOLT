import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

@injectable()
export class LammpsDaemonRuntimeService {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async provisionContainer(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.container.provision,
            payload,
            {
                timeoutMs: 30 * 60 * 1000
            }
        );
    }

    async removeWorkspaceContainer(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.container.removeWorkspace,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }

    async listFilesystem(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>[]>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.list,
            payload,
            {
                timeoutMs: 120_000
            }
        );
    }

    async readFile(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<{ contents: string }>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.readFile,
            payload,
            {
                timeoutMs: 120_000
            }
        );
    }

    async writeFile(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.writeFile,
            payload,
            {
                timeoutMs: 120_000
            }
        );
    }

    async writeFileBase64(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.writeFileBase64,
            payload,
            {
                timeoutMs: 120_000
            }
        );
    }

    async createFile(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.createFile,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }

    async createDirectory(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.createDirectory,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }

    async movePath(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.move,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }

    async deletePath(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.deletePath,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }

    async startRun(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<{ runtimeRunId: string }>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.run.start,
            payload,
            {
                timeoutMs: 30 * 60 * 1000
            }
        );
    }

    async stopRun(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.run.stop,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }

    async killRun(teamClusterId: string, payload: Record<string, unknown>) {
        return this.teamClusterDaemonClient.command<Record<string, unknown>>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.lammps.run.kill,
            payload,
            {
                timeoutMs: 60_000
            }
        );
    }
}

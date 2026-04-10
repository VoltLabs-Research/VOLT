import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import type { LammpsDaemonService } from '@/modules/lammps/services/LammpsDaemonService';
import {
    readOptionalPayloadRecord,
    readNumber,
    readOptionalString,
    readString,
    readStringArray
} from './payloadValidation';

interface LammpsHandlersDependencies {
    lammpsDaemonService: LammpsDaemonService;
}

const readProvisionRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        operationId: readString(record.operationId, 'operationId'),
        lammpsContainerId: readString(record.lammpsContainerId, 'lammpsContainerId'),
        name: readString(record.name, 'name'),
        packages: readStringArray(record.packages, 'packages'),
        cpus: readNumber(record.cpus, 'cpus'),
        workspaceContainerName: readOptionalString(record.workspaceContainerName).trim() || undefined
    };
};

const readWorkspaceRemoveRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        workspaceContainerId: readString(record.workspaceContainerId, 'workspaceContainerId')
    };
};

const readFilesystemPathRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        workspaceContainerId: readString(record.workspaceContainerId, 'workspaceContainerId'),
        targetPath: readString(record.targetPath, 'targetPath')
    };
};

const readFilesystemWriteRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        workspaceContainerId: readString(record.workspaceContainerId, 'workspaceContainerId'),
        targetPath: readString(record.targetPath, 'targetPath'),
        content: readOptionalString(record.content)
    };
};

const readFilesystemWriteBase64Request = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        workspaceContainerId: readString(record.workspaceContainerId, 'workspaceContainerId'),
        targetPath: readString(record.targetPath, 'targetPath'),
        contentBase64: readString(record.contentBase64, 'contentBase64')
    };
};

const readFilesystemMoveRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        workspaceContainerId: readString(record.workspaceContainerId, 'workspaceContainerId'),
        targetPath: readString(record.targetPath, 'targetPath'),
        destinationPath: readString(record.destinationPath, 'destinationPath')
    };
};

const readRunStartRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        executionId: readString(record.executionId, 'executionId'),
        scriptId: readString(record.scriptId, 'scriptId'),
        workspaceContainerId: readString(record.workspaceContainerId, 'workspaceContainerId'),
        projectRootPath: readString(record.projectRootPath, 'projectRootPath'),
        entryFilePath: readString(record.entryFilePath, 'entryFilePath'),
        imageTag: readString(record.imageTag, 'imageTag'),
        packages: readStringArray(record.packages, 'packages'),
        stagedTrajectoryId: readString(record.stagedTrajectoryId, 'stagedTrajectoryId'),
        storageClusterId: readString(record.storageClusterId, 'storageClusterId'),
        mpiRanks: readNumber(record.mpiRanks, 'mpiRanks'),
        openmpThreads: readNumber(record.openmpThreads, 'openmpThreads')
    };
};

const readRunControlRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);

    return {
        executionId: readString(record.executionId, 'executionId')
    };
};

export const createLammpsHandlers = (deps: LammpsHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.container.provision,
        execute: async (payload) => ({
            status: 201,
            data: await deps.lammpsDaemonService.provisionContainer(readProvisionRequest(payload))
        })
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.container.removeWorkspace,
        execute: async (payload) => {
            await deps.lammpsDaemonService.removeWorkspaceContainer(readWorkspaceRemoveRequest(payload));
            return {
                data: {
                    deleted: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.list,
        execute: async (payload) => ({
            data: await deps.lammpsDaemonService.listFilesystem(readFilesystemPathRequest(payload))
        })
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.readFile,
        execute: async (payload) => ({
            data: await deps.lammpsDaemonService.readFile(readFilesystemPathRequest(payload))
        })
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.writeFile,
        execute: async (payload) => {
            await deps.lammpsDaemonService.writeFile(readFilesystemWriteRequest(payload));
            return {
                data: {
                    written: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.writeFileBase64,
        execute: async (payload) => {
            await deps.lammpsDaemonService.writeFileBase64(readFilesystemWriteBase64Request(payload));
            return {
                data: {
                    written: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.createFile,
        execute: async (payload) => {
            await deps.lammpsDaemonService.createFile(readFilesystemPathRequest(payload));
            return {
                data: {
                    created: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.createDirectory,
        execute: async (payload) => {
            await deps.lammpsDaemonService.createDirectory(readFilesystemPathRequest(payload));
            return {
                data: {
                    created: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.move,
        execute: async (payload) => {
            await deps.lammpsDaemonService.movePath(readFilesystemMoveRequest(payload));
            return {
                data: {
                    moved: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.filesystem.deletePath,
        execute: async (payload) => {
            await deps.lammpsDaemonService.deletePath(readFilesystemPathRequest(payload));
            return {
                data: {
                    deleted: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.run.start,
        execute: async (payload) => ({
            status: 201,
            data: await deps.lammpsDaemonService.startRun(readRunStartRequest(payload))
        })
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.run.stop,
        execute: async (payload) => {
            await deps.lammpsDaemonService.stopRun(readRunControlRequest(payload));
            return {
                data: {
                    accepted: true
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.lammps.run.kill,
        execute: async (payload) => {
            await deps.lammpsDaemonService.killRun(readRunControlRequest(payload));
            return {
                data: {
                    accepted: true
                }
            };
        }
    }
];

import type { DaemonConfig } from '@/core/config';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { VoltCloudConnection } from '@/modules/cloud-control/services';
import type { GlbExporterService } from '@/modules/trajectory-native/services';
import type { MinioService, QueueService } from '@/modules/platform/services';
import { FileExtractorService, SSHConnectionService, SSHImportWorkerService } from './services';

export interface SSHImportModule {
    sshImportWorkerService: SSHImportWorkerService;
}

export const createSSHImportModule = (deps: {
    config: DaemonConfig;
    queueService: QueueService;
    minioService: MinioService;
    glbExporterService: GlbExporterService;
    daemonJobReporterService: DaemonJobReporterService;
    voltCloudConnection: VoltCloudConnection;
}): SSHImportModule => {
    const sshConnectionService = new SSHConnectionService();
    const fileExtractorService = new FileExtractorService();

    return {
        sshImportWorkerService: new SSHImportWorkerService(
            deps.config,
            deps.queueService,
            deps.minioService,
            deps.glbExporterService,
            deps.daemonJobReporterService,
            deps.voltCloudConnection,
            sshConnectionService,
            fileExtractorService
        )
    };
};

export { SSHImportWorkerService } from './services';

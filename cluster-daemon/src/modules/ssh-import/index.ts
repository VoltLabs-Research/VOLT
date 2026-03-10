import type { DaemonConfig } from '@/core/config';
import type { GlbExporterService } from '@/modules/trajectory-native/services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import { FileExtractorService, SSHConnectionService, SSHImportWorkerService } from './services';

export interface SSHImportModule {
    sshImportWorkerService: SSHImportWorkerService;
}

export const createSSHImportModule = (deps: {
    config: DaemonConfig;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    minioService: MinioService;
    glbExporterService: GlbExporterService;
}): SSHImportModule => {
    const sshConnectionService = new SSHConnectionService();
    const fileExtractorService = new FileExtractorService();

    return {
        sshImportWorkerService: new SSHImportWorkerService(
            deps.config,
            deps.queueService,
            deps.redisConnectionService,
            deps.minioService,
            deps.glbExporterService,
            sshConnectionService,
            fileExtractorService
        )
    };
};

export { SSHImportWorkerService } from './services';

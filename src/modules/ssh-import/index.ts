import type { DaemonConfig } from '@/core/config';
import type { GlbExporterService } from '@/modules/trajectory-native/services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import { FileExtractorService, SSHConnectionService, SSHImportFrameWorkerService, SSHImportWorkerService } from './services';

export interface SSHImportModule {
    sshImportFrameWorkerService: SSHImportFrameWorkerService;
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
    const sshImportFrameWorkerService = new SSHImportFrameWorkerService(
        deps.queueService,
        deps.minioService,
        deps.glbExporterService
    );

    return {
        sshImportFrameWorkerService,
        sshImportWorkerService: new SSHImportWorkerService(
            deps.config,
            deps.queueService,
            deps.redisConnectionService,
            sshConnectionService,
            fileExtractorService
        )
    };
};

export { SSHImportWorkerService } from './services';

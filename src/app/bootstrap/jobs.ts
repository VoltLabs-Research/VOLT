import { asFunction, createContainer } from 'awilix';
import { createJobControlService } from '@/modules/jobs/application/control/JobControlService';
import { createDaemonJobReporterService } from '@/modules/jobs/application/reporting/DaemonJobReporterService';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerJobsBootstrap = (container: BootstrapContainer): void => {
    container.register({
        jobControlService: asFunction(createJobControlService).singleton(),
        daemonJobReporterService: asFunction(createDaemonJobReporterService).singleton()
    });
};

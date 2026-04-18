import { asFunction, createContainer } from 'awilix';
import { createJobControlService } from '@/modules/jobs/application/control/JobControl';
import { createDaemonJobReporterService } from '@/modules/jobs/application/reporting/DaemonJobReporter';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerJobsBootstrap = (container: BootstrapContainer): void => {
    container.register({
        jobControl: asFunction(createJobControlService).singleton(),
        daemonJobReporter: asFunction(createDaemonJobReporterService).singleton()
    });
};

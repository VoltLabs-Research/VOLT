import { asClass, asFunction, createContainer } from 'awilix';
import { createFilterEvaluatorService } from '@/modules/trajectory/domain/services/FilterEvaluatorService';
import { createTrajectoryGlbQueueService } from '@/modules/trajectory/application/glb/TrajectoryGlbQueueService';
import { GlbExporterService } from '@/modules/trajectory/application/glb/GlbExporterService';
import { SSHImportWorkerService } from '@/modules/trajectory/application/import/SSHImportWorkerService';
import { TrajectoryGlbWorkerService } from '@/modules/trajectory/application/glb/TrajectoryGlbWorkerService';
import { TrajectoryPluginParserService } from '@/modules/trajectory/application/parsing/TrajectoryPluginParserService';
import { createTrajectoryParserService } from '@/modules/trajectory/application/parsing/TrajectoryParserService';
import { createTrajectoryRasterQueueService } from '@/modules/trajectory/application/raster/TrajectoryRasterQueueService';
import { createRasterizerService } from '@/modules/trajectory/application/raster/RasterizerService';
import { TrajectoryRasterWorkerService } from '@/modules/trajectory/application/raster/TrajectoryRasterWorkerService';
import { FileExtractorService } from '@/modules/trajectory/infrastructure/extraction/FileExtractorService';
import { SSHConnectionService } from '@/modules/trajectory/infrastructure/ssh/SSHConnectionService';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerTrajectoryBootstrap = (container: BootstrapContainer): void => {
    container.register({
        trajectoryParserService: asFunction(createTrajectoryParserService).singleton(),
        trajectoryPluginParserService: asClass(TrajectoryPluginParserService).singleton(),
        trajectoryRasterQueueService: asFunction(createTrajectoryRasterQueueService).singleton(),
        trajectoryGlbQueueService: asFunction(createTrajectoryGlbQueueService).singleton(),
        rasterizerService: asFunction(createRasterizerService).singleton(),
        glbExporterService: asClass(GlbExporterService).singleton(),
        filterEvaluatorService: asFunction(createFilterEvaluatorService).singleton(),
        sshConnectionService: asClass(SSHConnectionService).singleton(),
        fileExtractorService: asClass(FileExtractorService).singleton(),
        sshImportWorkerService: asClass(SSHImportWorkerService).singleton(),
        trajectoryRasterWorkerService: asClass(TrajectoryRasterWorkerService).singleton(),
        trajectoryGlbWorkerService: asClass(TrajectoryGlbWorkerService).singleton()
    });
};

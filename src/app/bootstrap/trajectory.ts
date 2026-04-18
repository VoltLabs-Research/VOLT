import { asClass, createContainer } from 'awilix';
import { FilterEvaluator } from '@/modules/trajectory/domain/services/FilterEvaluator';
import { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import { SSHImportWorker } from '@/modules/trajectory/application/import/SSHImportWorker';
import { TrajectoryGlbWorker } from '@/modules/trajectory/application/glb/TrajectoryGlbWorker';
import { TrajectoryPluginParser } from '@/modules/trajectory/application/parsing/TrajectoryPluginParser';
import { TrajectoryParser } from '@/modules/trajectory/application/parsing/TrajectoryParser';
import { TrajectoryRasterQueue } from '@/modules/trajectory/application/raster/TrajectoryRasterQueue';
import { Rasterizer } from '@/modules/trajectory/application/raster/Rasterizer';
import { TrajectoryRasterWorker } from '@/modules/trajectory/application/raster/TrajectoryRasterWorker';
import { FileExtractor } from '@/modules/trajectory/infrastructure/extraction/FileExtractor';
import { SSHConnection } from '@/modules/trajectory/infrastructure/ssh/SSHConnection';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerTrajectoryBootstrap = (container: BootstrapContainer): void => {
    container.register({
        trajectoryParser: asClass(TrajectoryParser).singleton(),
        trajectoryPluginParser: asClass(TrajectoryPluginParser).singleton(),
        trajectoryRasterQueue: asClass(TrajectoryRasterQueue).singleton(),
        rasterizer: asClass(Rasterizer).singleton(),
        glbExporter: asClass(GlbExporter).singleton(),
        filterEvaluator: asClass(FilterEvaluator).singleton(),
        sshConnection: asClass(SSHConnection).singleton(),
        fileExtractor: asClass(FileExtractor).singleton(),
        sshImportWorker: asClass(SSHImportWorker).singleton(),
        trajectoryRasterWorker: asClass(TrajectoryRasterWorker).singleton(),
        trajectoryGlbWorker: asClass(TrajectoryGlbWorker).singleton()
    });
};

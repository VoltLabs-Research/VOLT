import {
    createFilterEvaluatorService,
    createGlbExporterService,
    NativeModuleLoader,
    createRasterizerService,
    createTrajectoryParserService,
    TrajectoryPluginParserService,
    type FilterEvaluatorService,
    type GlbExporterService,
    type RasterizerService,
    type TrajectoryParserService
} from './services';
import type { MinioService } from '@/modules/platform/services';

export interface TrajectoryNativeModule {
    nativeModuleLoader: NativeModuleLoader;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    rasterizerService: RasterizerService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
}

export const createTrajectoryNativeModule = (minioService: MinioService): TrajectoryNativeModule => {
    const nativeModuleLoader = new NativeModuleLoader();
    const trajectoryParserService = createTrajectoryParserService(minioService, nativeModuleLoader);
    const trajectoryPluginParserService = new TrajectoryPluginParserService(minioService);
    const rasterizerService = createRasterizerService(minioService, nativeModuleLoader);
    const glbExporterService = createGlbExporterService(
        minioService,
        nativeModuleLoader,
        trajectoryParserService,
        rasterizerService
    );
    const filterEvaluatorService = createFilterEvaluatorService(minioService, nativeModuleLoader, trajectoryParserService);

    return {
        nativeModuleLoader,
        trajectoryParserService,
        trajectoryPluginParserService,
        rasterizerService,
        glbExporterService,
        filterEvaluatorService
    };
};

import {
    createFilterEvaluatorService,
    createGlbExporterService,
    NativeModuleLoader,
    createRasterizerService,
    createTrajectoryParserService,
    type FilterEvaluatorService,
    type GlbExporterService,
    type RasterizerService,
    type TrajectoryParserService
} from './services';
import type { MinioService } from '../platform/services';

export interface TrajectoryNativeModule {
    nativeModuleLoader: NativeModuleLoader;
    trajectoryParserService: TrajectoryParserService;
    rasterizerService: RasterizerService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
}

export const createTrajectoryNativeModule = (minioService: MinioService): TrajectoryNativeModule => {
    const nativeModuleLoader = new NativeModuleLoader();
    const trajectoryParserService = createTrajectoryParserService(minioService, nativeModuleLoader);
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
        rasterizerService,
        glbExporterService,
        filterEvaluatorService
    };
};

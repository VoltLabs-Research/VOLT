import ProcessDaemonJobCompletionUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
import ProcessDaemonTrajectoryImportUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonTrajectoryImportUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';
import { z } from 'zod/v4';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/v1/daemon',
    router
};

const requiredTextSchema = z.string().trim().min(1);

const jobCompletionSchema = z.object({
    daemonPassword: requiredTextSchema,
    teamClusterId: requiredTextSchema,
    jobId: requiredTextSchema,
    analysisId: requiredTextSchema,
    teamId: requiredTextSchema,
    success: z.boolean(),
    error: z.string().optional()
}).strict();

const jobCompletionValidation = createValidationMiddleware({
    body: jobCompletionSchema
});

const importedFrameSchema = z.object({
    timestep: z.number(),
    natoms: z.number(),
    simulationCell: z.record(z.string(), z.unknown()).nullable(),
    size: z.number()
}).strict();

const trajectoryImportSchema = z.object({
    daemonPassword: requiredTextSchema,
    teamClusterId: requiredTextSchema,
    trajectoryId: requiredTextSchema,
    trajectoryName: requiredTextSchema,
    teamId: requiredTextSchema,
    userId: requiredTextSchema,
    success: z.boolean(),
    frames: z.array(importedFrameSchema).optional(),
    failureCode: z.string().optional(),
    failureDetails: z.string().optional()
}).strict();

const trajectoryImportValidation = createValidationMiddleware({
    body: trajectoryImportSchema
});

const jobCompletionRateLimiter = createStandardRateLimiter(
    120,
    'Too many daemon job completion requests, please try again later'
);

const ProcessDaemonJobCompletionController = createController(ProcessDaemonJobCompletionUseCase);
const ProcessDaemonTrajectoryImportController = createController(ProcessDaemonTrajectoryImportUseCase);

router.post(
    '/job-completion',
    jobCompletionRateLimiter,
    jobCompletionValidation,
    new ProcessDaemonJobCompletionController().handle
);

router.post(
    '/trajectory-import',
    jobCompletionRateLimiter,
    trajectoryImportValidation,
    new ProcessDaemonTrajectoryImportController().handle
);

export default module;

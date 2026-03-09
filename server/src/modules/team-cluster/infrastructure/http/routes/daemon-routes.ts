import ProcessDaemonJobCompletionUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
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

const jobCompletionRateLimiter = createStandardRateLimiter(
    120,
    'Too many daemon job completion requests, please try again later'
);

const ProcessDaemonJobCompletionController = createController(ProcessDaemonJobCompletionUseCase);

router.post(
    '/job-completion',
    jobCompletionRateLimiter,
    jobCompletionValidation,
    new ProcessDaemonJobCompletionController().handle
);

export default module;

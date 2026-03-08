import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const createTeamAIIntegrationSchema = z.object({
    apiKey: z.string().min(1).optional(),
    isEnabled: z.boolean().optional(),
    defaultModel: z.string().min(1).optional(),
    enabledModels: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
}).strict();

const updateTeamAIIntegrationSchema = createTeamAIIntegrationSchema.partial();

const discoverTeamAIProviderModelsSchema = z.object({
    provider: z.string().min(1),
    apiKey: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
}).strict();

export const teamAIIntegrationValidation = {
    create: createValidationMiddleware(createTeamAIIntegrationSchema),
    update: createValidationMiddleware(updateTeamAIIntegrationSchema),
    discoverModels: createValidationMiddleware(discoverTeamAIProviderModelsSchema)
};

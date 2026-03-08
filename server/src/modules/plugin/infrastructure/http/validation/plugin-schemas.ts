import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';

const workflowNodeSchema = z.object({
    id: z.string().min(1),
    type: z.enum([
        'modifier',
        'arguments',
        'context',
        'forEach',
        'entrypoint',
        'exposure',
        'export',
        'if-statement'
    ]),
    position: z.object({
        x: z.number(),
        y: z.number()
    }).strict(),
    data: z.record(z.string(), z.unknown())
}).strict();

const workflowEdgeSchema = z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    sourceHandle: z.string().optional(),
    target: z.string().min(1),
    targetHandle: z.string().optional()
}).strict();

const workflowViewportSchema = z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number()
}).strict();

const workflowSchema = z.object({
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
    viewport: workflowViewportSchema.optional()
}).strict();

const createPluginSchema = z.object({
    workflow: workflowSchema
}).strict();

const updatePluginSchema = z.object({
    workflow: workflowSchema.optional(),
    status: z.enum(['draft', 'published', 'disabled']).optional()
}).strict();

const validateWorkflowSchema = z.object({
    workflow: workflowSchema
}).strict();

export const pluginValidation = {
    create: createValidationMiddleware(createPluginSchema),
    update: createValidationMiddleware(updatePluginSchema),
    validateWorkflow: createValidationMiddleware(validateWorkflowSchema)
};

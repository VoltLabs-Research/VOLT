import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { objectIdSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const workflowNodeSchema = z.object({
    id: z.string().min(1),
    type: z.enum([
        'modifier',
        'arguments',
        'context',
        'forEach',
        'entrypoint',
        'plugin-node',
        'exposure',
        'export',
        'if-statement',
        'switch-statement',
        'switch-case'
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

const executePluginSchema = z.object({
    teamClusterId: objectIdSchema,
    selectedFrameOnly: z.boolean().optional(),
    selectedTimesteps: z.array(z.number()).optional(),
    timestep: z.number().optional(),
    config: z.record(z.string(), z.unknown())
}).strict();

export const pluginValidation = createResourceValidation({
    create: createPluginSchema,
    update: updatePluginSchema,
    validateWorkflow: validateWorkflowSchema,
    execute: executePluginSchema
});

import { z } from 'zod/v4';

export const requiredTextSchema = z.string().trim().min(1);

export const resourceNameSchema = z.string().min(1).max(100);

export const resourceDescriptionSchema = z.string().max(500);

export const createNamedResourceSchema = () => z.object({
    name: resourceNameSchema,
    description: resourceDescriptionSchema
}).strict();

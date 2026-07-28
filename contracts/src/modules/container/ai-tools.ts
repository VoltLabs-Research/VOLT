import { z } from 'zod';
import type { PortMapping } from './domain';

const portMapping: z.ZodType<PortMapping> = z.object({
    private: z.number(),
    public: z.number()
});

export const containerRefSchema = z.object({ containerId: z.string() });

export const createContainerSchema = z.object({
    name: z.string(),
    image: z.string(),
    tag: z.string().optional(),
    ports: z.array(portMapping).optional(),
    reason: z.string().optional()
});

export const listContainersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50)
});

export const listContainerFilesSchema = z.object({
    containerId: z.string(),
    path: z.string().optional().default('/')
});

export const readContainerFileSchema = z.object({
    containerId: z.string(),
    path: z.string()
});

export const getContainerPortAccessUrlSchema = z.object({
    containerId: z.string(),
    port: z.number()
});

export const updateContainerSchema = z.object({
    containerId: z.string(),
    name: z.string().optional(),
    reason: z.string().optional()
});

export const moveContainerSchema = z.object({
    containerId: z.string(),
    folderId: z.string().nullable()
});

export const deleteContainerSchema = z.object({
    containerId: z.string(),
    reason: z.string().optional()
});

export type ContainerRefInput = z.infer<typeof containerRefSchema>;
export type CreateContainerInput = z.infer<typeof createContainerSchema>;
export type ListContainersInput = z.infer<typeof listContainersSchema>;
export type ListContainerFilesInput = z.infer<typeof listContainerFilesSchema>;
export type ReadContainerFileInput = z.infer<typeof readContainerFileSchema>;
export type GetContainerPortAccessUrlInput = z.infer<typeof getContainerPortAccessUrlSchema>;
export type UpdateContainerInput = z.infer<typeof updateContainerSchema>;
export type MoveContainerInput = z.infer<typeof moveContainerSchema>;
export type DeleteContainerInput = z.infer<typeof deleteContainerSchema>;

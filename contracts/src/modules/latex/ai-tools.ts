import { z } from 'zod';

export const latexDocumentRefSchema = z.object({ documentId: z.string() });

export const latexFileRefSchema = z.object({
    documentId: z.string(),
    fileId: z.string()
});

export const createLatexDocumentSchema = z.object({
    title: z.string(),
    folderId: z.string().nullable().optional()
});

export const listLatexDocumentsSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    search: z.string().optional(),
    folderId: z.string().optional()
});

export const updateLatexDocumentSchema = z.object({
    documentId: z.string(),
    title: z.string().optional()
});

export const moveLatexDocumentSchema = z.object({
    documentId: z.string(),
    folderId: z.string().nullable()
});

export const createLatexFileSchema = z.object({
    documentId: z.string(),
    name: z.string(),
    path: z.string().optional(),
    content: z.string().optional(),
    isEntrypoint: z.boolean().optional()
});

export const updateLatexFileSchema = z.object({
    documentId: z.string(),
    fileId: z.string(),
    name: z.string().optional(),
    path: z.string().optional(),
    content: z.string().optional()
});

export const manageLatexAssetsSchema = z.object({
    documentId: z.string(),
    action: z.enum(['list', 'export']),
    format: z.enum(['tex', 'zip']).optional()
});

export type LatexDocumentRefInput = z.infer<typeof latexDocumentRefSchema>;
export type LatexFileRefInput = z.infer<typeof latexFileRefSchema>;
export type CreateLatexDocumentInput = z.infer<typeof createLatexDocumentSchema>;
export type ListLatexDocumentsInput = z.infer<typeof listLatexDocumentsSchema>;
export type UpdateLatexDocumentInput = z.infer<typeof updateLatexDocumentSchema>;
export type MoveLatexDocumentInput = z.infer<typeof moveLatexDocumentSchema>;
export type CreateLatexFileInput = z.infer<typeof createLatexFileSchema>;
export type UpdateLatexFileInput = z.infer<typeof updateLatexFileSchema>;
export type ManageLatexAssetsInput = z.infer<typeof manageLatexAssetsSchema>;

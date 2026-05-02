import { z } from 'zod/v4';

export interface LatexOpenDocumentPayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
}

export interface LatexCloseDocumentPayload extends Record<string, unknown> {
    documentId: string;
}

export interface LatexUpdateContentPayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
    /** ID of the LatexFile being edited. */
    fileId: string;
    content: string;
    timestamp: number;
}

const nonEmptyString = z.string().trim().min(1);

export const latexOpenDocumentSchema = z.object({
    documentId: nonEmptyString,
    teamId: nonEmptyString
});

export const latexCloseDocumentSchema = z.object({
    documentId: nonEmptyString
});

export const latexUpdateContentSchema = z.object({
    documentId: nonEmptyString,
    teamId: nonEmptyString,
    fileId: z.string().trim().min(1),
    content: z.string(),
    timestamp: z.number()
});

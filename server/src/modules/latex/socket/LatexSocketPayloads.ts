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

export interface LatexFileJoinPayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
    fileId: string;
}

export interface LatexFileLeavePayload extends Record<string, unknown> {
    documentId: string;
    fileId: string;
}

export interface LatexFileUpdatePayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
    fileId: string;
    update: number[];
}

const nonEmptyString = z.string().trim().min(1);
const updatePayloadSchema = z.array(z.number().int().min(0).max(255));

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

export const latexFileJoinSchema = z.object({
    documentId: nonEmptyString,
    teamId: nonEmptyString,
    fileId: nonEmptyString
});

export const latexFileLeaveSchema = z.object({
    documentId: nonEmptyString,
    fileId: nonEmptyString
});

export const latexFileUpdateSchema = z.object({
    documentId: nonEmptyString,
    teamId: nonEmptyString,
    fileId: nonEmptyString,
    update: updatePayloadSchema
});

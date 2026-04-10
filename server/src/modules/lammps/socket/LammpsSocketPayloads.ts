import { z } from 'zod/v4';

export interface LammpsOpenScriptPayload extends Record<string, unknown> {
    scriptId: string;
    teamId: string;
};

export interface LammpsCloseScriptPayload extends Record<string, unknown> {
    scriptId: string;
};

export interface LammpsOpenExecutionPayload extends Record<string, unknown> {
    executionId: string;
    teamId: string;
};

export interface LammpsCloseExecutionPayload extends Record<string, unknown> {
    executionId: string;
};

export interface LammpsUpdateContentPayload extends Record<string, unknown> {
    scriptId: string;
    teamId: string;
    fileId: string;
    content: string;
    timestamp: number;
};

const nonEmptyString = z.string().trim().min(1);

export const lammpsOpenScriptSchema = z.object({
    scriptId: nonEmptyString,
    teamId: nonEmptyString
});

export const lammpsCloseScriptSchema = z.object({
    scriptId: nonEmptyString
});

export const lammpsOpenExecutionSchema = z.object({
    executionId: nonEmptyString,
    teamId: nonEmptyString
});

export const lammpsCloseExecutionSchema = z.object({
    executionId: nonEmptyString
});

export const lammpsUpdateContentSchema = z.object({
    scriptId: nonEmptyString,
    teamId: nonEmptyString,
    fileId: nonEmptyString,
    content: z.string(),
    timestamp: z.number()
});

import { z } from 'zod/v4';
import type { ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';

const emailSchema = z.string().trim().email();
const requiredStringSchema = z.string().trim().min(1);

const signInSchema = z.object({
    email: emailSchema,
    password: requiredStringSchema
});

const signUpSchema = z.object({
    email: emailSchema,
    firstName: requiredStringSchema.max(64),
    lastName: requiredStringSchema.max(64),
    password: z.string().min(8)
});

const checkEmailSchema = z.object({
    email: emailSchema
});

const updatePasswordSchema = z.object({
    passwordCurrent: requiredStringSchema.optional(),
    password: z.string().min(8)
});

const updateAccountSchema = z.object({
    email: emailSchema.optional(),
    firstName: requiredStringSchema.max(64).optional(),
    lastName: requiredStringSchema.max(64).optional(),
    fullName: requiredStringSchema.max(128).optional()
});

const guestIdentitySchema = z.object({
    seed: requiredStringSchema.max(256)
});

export const authValidation = {
    signIn: {
        body: signInSchema
    } satisfies ValidationSchemaInput,
    signUp: {
        body: signUpSchema
    } satisfies ValidationSchemaInput,
    checkEmail: {
        body: checkEmailSchema
    } satisfies ValidationSchemaInput,
    updatePassword: {
        body: updatePasswordSchema
    } satisfies ValidationSchemaInput,
    updateAccount: {
        body: updateAccountSchema
    } satisfies ValidationSchemaInput,
    getGuestIdentity: {
        query: guestIdentitySchema
    } satisfies ValidationSchemaInput
};

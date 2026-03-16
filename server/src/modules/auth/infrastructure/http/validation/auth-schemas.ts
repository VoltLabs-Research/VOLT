import { z } from 'zod/v4';
import type { ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';

const emailSchema = z.string().trim().email();
const requiredStringSchema = z.string().trim().min(1);
const firstNameSchema = z.string().trim().min(1).max(64);
const nameSchema = z.string().trim().max(64);

const signInSchema = z.object({
    email: emailSchema,
    password: requiredStringSchema
});

const signUpSchema = z.object({
    email: emailSchema,
    firstName: firstNameSchema,
    lastName: nameSchema.optional(),
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
    firstName: firstNameSchema.optional(),
    lastName: nameSchema.optional(),
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
        params: checkEmailSchema
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

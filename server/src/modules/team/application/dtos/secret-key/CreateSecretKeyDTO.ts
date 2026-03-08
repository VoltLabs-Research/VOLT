import { z } from 'zod';
import { ErrorCodes } from '@core/constants/error-codes';

export const secretKeyNameSchema = z.string().trim().min(1, ErrorCodes.SECRET_KEY_NAME_REQUIRED).max(100);
export const secretKeyRoleIdSchema = z.string().min(1, ErrorCodes.SECRET_KEY_ROLE_REQUIRED);
export const createSecretKeyInputSchema = z.object({
    teamId: z.string().min(1, ErrorCodes.TEAM_ID_REQUIRED),
    roleId: secretKeyRoleIdSchema,
    name: secretKeyNameSchema,
    userId: z.string().min(1, ErrorCodes.AUTHENTICATION_REQUIRED)
});

export type CreateSecretKeyInputDTO = z.input<typeof createSecretKeyInputSchema>;

export interface CreateSecretKeyOutputDTO {
    secretKeyId: string;
    teamId: string;
    roleId: string;
    name: string;
    keyPrefix: string;
    secretKey: string;
    isActive: boolean;
    createdAt: Date;
}

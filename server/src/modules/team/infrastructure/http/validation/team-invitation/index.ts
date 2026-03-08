import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const sendInvitationSchema = z.object({
    email: z.string().email(),
    roleId: z.string().min(1).optional()
}).strict();

const updateInvitationSchema = z.object({
    status: z.enum(['pending', 'accepted', 'rejected'])
}).strict();

export const teamInvitationValidation = {
    send: createValidationMiddleware(sendInvitationSchema),
    update: createValidationMiddleware(updateInvitationSchema)
};

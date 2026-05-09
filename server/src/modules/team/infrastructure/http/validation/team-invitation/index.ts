import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createObjectIdParamsSchema,
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const sendInvitationSchema = z.object({
    email: z.string().email(),
    roleId: z.string().min(1).optional()
}).strict();

const updateInvitationSchema = z.object({
    status: z.enum(['pending', 'accepted', 'rejected'])
}).strict();

const invitationParamsSchema = createObjectIdParamsSchema(['invitationId']);
const teamInvitationParamsSchema = createTeamScopedParamsSchema('invitationId');

export const teamInvitationValidation = createResourceValidation({
    listPending: {
        params: teamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 200 })
    },
    getById: {
        params: invitationParamsSchema
    },
    send: {
        params: teamParamsSchema,
        body: sendInvitationSchema
    },
    update: {
        params: teamInvitationParamsSchema,
        body: updateInvitationSchema
    },
    deleteById: {
        params: teamInvitationParamsSchema
    },
    statusById: {
        params: teamInvitationParamsSchema
    },
    publicStatusById: {
        params: invitationParamsSchema
    }
});

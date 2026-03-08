import { z } from 'zod/v4';

const teamIdSchema = z.string().trim().min(1);

export const teamScopedSocketPayloadSchema = z.object({
    teamId: teamIdSchema
});

export const subscribeToTeamSocketPayloadSchema = teamScopedSocketPayloadSchema.extend({
    previousTeamId: teamIdSchema.optional()
});

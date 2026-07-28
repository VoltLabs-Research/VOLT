import { z } from 'zod';

export const trajectoryRefSchema = z.object({ trajectoryId: z.string() });

export type TrajectoryRefInput = z.infer<typeof trajectoryRefSchema>;

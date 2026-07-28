import { z } from 'zod';

export const getSimulationCellSchema = z.object({ trajectoryId: z.string(), timestep: z.number().optional() });

export type GetSimulationCellInput = z.infer<typeof getSimulationCellSchema>;

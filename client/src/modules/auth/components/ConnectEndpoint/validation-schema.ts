import { z } from 'zod';

export interface ConnectEndpointForm {
    endpoint: string;
}

export const connectEndpointSchema = z.object({
    endpoint: z
        .string()
        .min(1, 'Server address is required')
});

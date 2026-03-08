import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';

export const registerRasterSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'session.completed': RASTER_TOKENS.RasterSessionCompletedEventHandler
    });
};

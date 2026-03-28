import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';

export interface ScreenshotComposition {
    framingBoundsWorld?: ModelWorldBounds | null;
    cropBoundsWorld?: ModelWorldBounds | null;
    cropSource?: 'simulation-cell';
};

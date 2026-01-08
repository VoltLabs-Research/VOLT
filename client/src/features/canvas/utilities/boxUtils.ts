import type { BoxBounds } from '@/types/models';

export interface BoxTransforms {
    scale: number;
    position: { x: number; y: number; z: number };
    center: { x: number; y: number; z: number };
    maxDimension: number;
}

export const calculateBoxTransforms = (boxBounds: BoxBounds): BoxTransforms => {
    // 1. Calcular dimensiones
    const width = boxBounds.xhi - boxBounds.xlo;
    const height = boxBounds.yhi - boxBounds.ylo;
    const depth = boxBounds.zhi - boxBounds.zlo;

    // 2. Calcular centro
    const center = {
        x: (boxBounds.xlo + boxBounds.xhi) / 2,
        y: (boxBounds.ylo + boxBounds.yhi) / 2,
        z: (boxBounds.zlo + boxBounds.zhi) / 2
    };

    // 3. Calcular maxDimension
    const maxDimension = Math.max(width, height, depth);

    // 4. Calcular escala (normalización a 8 unidades)
    const targetSize = 8;
    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;

    // 5. Calcular posición de centrado
    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale
    };

    return { scale, position, center, maxDimension };
};

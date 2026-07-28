import type { Vec3 } from '@/shared/contracts/geometry';

export const updateVec3Value = (current: Vec3, axis: number, value: number): Vec3 => {
    const next = [...current] as Vec3;
    next[axis] = value;
    return next;
};

export const isEnumValue = <T extends string>(
    value: string,
    enumObject: Record<string, T>
): value is T => {
    return Object.values(enumObject).includes(value as T);
};

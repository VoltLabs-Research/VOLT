import { ParseResult } from '@modules/trajectory/domain/contracts/trajectory';

export const getPropertyValues = (parsed: ParseResult, property: string): Float32Array => {
    const lowerProp = property.toLowerCase();

    if (lowerProp === 'type') {
        return new Float32Array(parsed.types);
    }

    if (lowerProp === 'x') {
        const values = new Float32Array(parsed.positions.length / 3);
        for (let i = 0; i < values.length; i++) {
            values[i] = parsed.positions[i * 3];
        }
        return values;
    }

    if (lowerProp === 'y') {
        const values = new Float32Array(parsed.positions.length / 3);
        for (let i = 0; i < values.length; i++) {
            values[i] = parsed.positions[i * 3 + 1];
        }
        return values;
    }

    if (lowerProp === 'z') {
        const values = new Float32Array(parsed.positions.length / 3);
        for (let i = 0; i < values.length; i++) {
            values[i] = parsed.positions[i * 3 + 2];
        }
        return values;
    }

    if (lowerProp === 'id' && parsed.ids) {
        const values = new Float32Array(parsed.ids.length);
        for (let i = 0; i < parsed.ids.length; i++) {
            values[i] = parsed.ids[i];
        }
        return values;
    }

    return parsed.properties?.[property] || parsed.properties?.[lowerProp] || new Float32Array(0);
};

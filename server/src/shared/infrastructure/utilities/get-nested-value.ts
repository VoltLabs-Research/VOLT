const getNestedValue = (obj: unknown, path: string): unknown => {
    return path.split('.').reduce<unknown>((accumulator, key) => {
        if (typeof accumulator !== 'object' || accumulator === null) {
            return undefined;
        }

        return Reflect.get(accumulator, key);
    }, obj);
};

export default getNestedValue;

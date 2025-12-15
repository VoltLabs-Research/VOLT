export const getValueByPath = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;

    // Fast path for simple keys without dots
    if (path.indexOf('.') === -1) {
        return obj?.[path];
    }

    return path
        .split('.')
        .reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
};

export default getValueByPath;

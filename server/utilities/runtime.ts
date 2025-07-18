export const filterObject = (object: Record<string, any>, ...fields: string[]): Record<string, any> => {
    return fields.reduce((newObj, key) => {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            newObj[key] = object[key];
        }
        return newObj;
    }, {} as Record<string, any>);
};
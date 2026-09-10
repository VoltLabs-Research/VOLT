const hiddenFields = new WeakMap<object, Set<string>>();

export const Hidden = (): PropertyDecorator => {
    return (target, propertyKey) => {
        const ctor = target.constructor;
        let fields = hiddenFields.get(ctor);
        if(!fields){
            fields = new Set();
            hiddenFields.set(ctor, fields);
        }
        fields.add(String(propertyKey));
    };
};

export const getHiddenFields = (ctor: object): Set<string> => {
    const collected = new Set<string>();
    let current: unknown = ctor;
    while(typeof current === 'function' && current !== Function.prototype){
        const own = hiddenFields.get(current);
        if(own){
            for(const field of own) collected.add(field);
        }
        current = Object.getPrototypeOf(current);
    }
    return collected;
};

export const singleton = <T>(create: () => T): (() => T) => {
    let instance: T | null = null;
    return () => (instance ??= create());
};

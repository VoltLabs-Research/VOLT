type ClassValue = string | boolean | undefined | null;

export const cn = (...classes: ClassValue[]): string => {
    return classes.filter(Boolean).join(' ');
};

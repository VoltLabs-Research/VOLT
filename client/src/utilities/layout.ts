import type { LayoutKey } from '@/types/animation';

export const getLayoutKey = (pathname: string): LayoutKey => {
    if(pathname.startsWith('/dashboard')) return 'dashboard';
    if(pathname.startsWith('/auth')) return 'auth';
    if(pathname.startsWith('/canvas')) return 'canvas';
    return 'default';
};

export const detectSameLayout = (currentLayoutKey: LayoutKey, storageKey: string): boolean => {
    const previousLayoutKey = sessionStorage.getItem(storageKey);
    const same = previousLayoutKey === currentLayoutKey;
    sessionStorage.setItem(storageKey, currentLayoutKey);
    return same;
};

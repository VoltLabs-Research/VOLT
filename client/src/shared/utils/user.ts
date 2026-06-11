export const getInitialsFromEmail = (email: string): string => {
    if(!email) return '?';
    return email.split('@')[0].charAt(0).toUpperCase();
};

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

export const getAvatarColorFromString = (str: string): string => {
    if(!str) return AVATAR_COLORS[0];
    const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

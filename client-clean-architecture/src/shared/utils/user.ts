import type { User } from '@/modules/auth/domain/entities/User';

export const getInitialsFromUser = (user: User | string | null | undefined): string => {
    if(!user || typeof user === 'string') return '?';
    
    if(user.firstName && user.lastName){
        return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    
    if(user.email){
        const parts = user.email.split('@')[0].split('.');
        if(parts.length >= 2){
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return user.email[0].toUpperCase();
    }
    
    return '?';
};

export const getUserDisplayName = (user: User | string | null | undefined): string => {
    if(!user || typeof user === 'string') return 'Unknown';
    
    if(user.firstName && user.lastName){
        return `${user.firstName} ${user.lastName}`;
    }
    
    if(user.email){
        return user.email.split('@')[0];
    }
    
    return 'Unknown';
};

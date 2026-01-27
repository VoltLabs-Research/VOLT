export interface User {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'user' | 'admin';
    avatar?: string;
    createdAt: string;
    updatedAt: string;
    [key: string]: any;
}

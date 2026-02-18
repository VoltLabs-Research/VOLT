import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface SSHConnection extends BaseEntity {
    name: string;
    host: string;
    port: number;
    username: string;
    team: string;
    user: string;
};

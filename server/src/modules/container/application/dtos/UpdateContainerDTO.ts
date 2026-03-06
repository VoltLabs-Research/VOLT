import type { Container } from '@modules/container/domain/entities/Container';

export interface UpdateContainerInputDTO {
    containerId: string;
    action?: 'start' | 'stop' | 'restart';
    env?: Array<{ key: string; value: string }>;
    ports?: Array<{ private: number; public: number }>;
}

export interface UpdateContainerOutputDTO {
    container: Container | null;
    status?: string;
}

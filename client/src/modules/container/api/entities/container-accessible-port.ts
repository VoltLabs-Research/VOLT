export interface ContainerAccessiblePort {
    private: number;
    public?: number;
    protocol: 'tcp';
    browserAccessible: boolean;
    status: 'available' | 'unavailable';
    label?: string;
};

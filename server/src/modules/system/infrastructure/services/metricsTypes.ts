export type ServerStatus = 'Healthy' | 'Warning' | 'Critical';

export interface NetworkCheck {
    bytes: { received: number; sent: number };
    timestamp: number;
}

export interface CPUTimes {
    idle: number;
    total: number;
}

export interface DiskIOCheck {
    reads: number;
    writes: number;
    timestamp: number;
    readSectors: number;
    writeSectors: number;
}

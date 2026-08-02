import si from 'systeminformation';
import { logger } from '@shared/infrastructure/logger';
import { selectAvailableMemoryMb } from '@shared/domain/utilities/runtime-capacity';

/** Decides if there is free memory for another process, sampling at most once per second. */

const MEM_SAMPLE_CACHE_TTL_MS = 1_000;

export class PluginProcessMemoryGuard {
    private sample: { freeMb: number; capturedAt: number } | null = null;
    private sampleInFlight: Promise<number> | null = null;

    public constructor(private readonly estimatedProcessMemoryMb: number) {}

    public async hasHeadroomForSpawn(): Promise<boolean> {
        try {
            const freeMemoryMb = await this.readFreeSystemMemoryMb();
            return freeMemoryMb >= this.estimatedProcessMemoryMb;
        } catch (error: unknown) {
            logger.warn({ err: error }, '@plugin-process-pool: failed to sample system memory; allowing spawn');
            return true;
        }
    }

    private async readFreeSystemMemoryMb(): Promise<number> {
        const cached = this.sample;
        if (cached && Date.now() - cached.capturedAt < MEM_SAMPLE_CACHE_TTL_MS) {
            return cached.freeMb;
        }
        if (this.sampleInFlight) {
            return this.sampleInFlight;
        }

        const inFlight = (async (): Promise<number> => {
            const freeMb = selectAvailableMemoryMb(await si.mem());
            this.sample = {
                freeMb,
                capturedAt: Date.now()
            };
            return freeMb;
        })();
        this.sampleInFlight = inFlight;
        try {
            return await inFlight;
        } finally {
            if (this.sampleInFlight === inFlight) {
                this.sampleInFlight = null;
            }
        }
    }
}

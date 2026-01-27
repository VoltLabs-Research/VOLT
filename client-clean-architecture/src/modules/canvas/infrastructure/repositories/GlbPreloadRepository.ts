import type { IGlbPreloadRepository } from '../../domain/repositories/IGlbPreloadRepository';
import { loadGLB } from '../loaders/GlbLoader';

export class GlbPreloadRepository implements IGlbPreloadRepository {
    async preload(url: string, onProgress?: (progress: number) => void): Promise<void> {
        await loadGLB(url, onProgress);
    }
}

export const glbPreloadRepository = new GlbPreloadRepository();

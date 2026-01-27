import type { IHardwareDetector } from '../../application/use-cases/PreloadFramesUseCase';

/**
 * Browser-based hardware detector adapter.
 */
export class HardwareDetectorAdapter implements IHardwareDetector {
    /**
     * Gets the number of logical processors available.
     */
    getConcurrency(): number {
        if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
            return navigator.hardwareConcurrency;
        }
        return 8; // Default fallback
    }
}

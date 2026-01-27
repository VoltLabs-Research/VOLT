import type { IPlaybackRepository } from '../../domain/repositories/IPlaybackRepository';

/**
 * Options for playback execution.
 */
export interface PlaybackOptions {
    /** Callback when timestep changes */
    onTimestepChange?: (timestep: number) => void;
    /** Callback when playback stops */
    onStop?: () => void;
}

/**
 * Result yielded by the playback generator.
 */
export interface PlaybackYield {
    currentTimestep: number;
    isPlaying: boolean;
}

/**
 * Use case for managing timestep playback.
 * Orchestrates the playback loop with proper timing.
 */
export class PlaybackUseCase {
    private abortController: AbortController | null = null;

    constructor(private readonly repository: IPlaybackRepository) {}

    /**
     * Starts playback and yields state updates.
     * Can be aborted by calling stop().
     */
    async *execute(options?: PlaybackOptions): AsyncGenerator<PlaybackYield> {
        const timesteps = this.repository.getTimesteps();
        if (timesteps.length === 0) return;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        this.repository.setState({ isPlaying: true });

        try {
            while (!signal.aborted) {
                const state = this.repository.getState();
                if (!state.isPlaying) break;

                const nextTimestep = this.computeNextTimestep(
                    state.currentTimestep,
                    timesteps
                );

                if (nextTimestep === null) {
                    break;
                }

                this.repository.setState({ currentTimestep: nextTimestep });
                options?.onTimestepChange?.(nextTimestep);

                yield {
                    currentTimestep: nextTimestep,
                    isPlaying: true
                };

                // Wait for model loading if needed
                await this.waitForModelLoading(signal);
                if (signal.aborted) break;

                // Frame delay based on play speed
                const frameDelay = this.computeFrameDelay(state.playSpeed);
                await this.delay(frameDelay, signal);
            }
        } finally {
            this.repository.setState({ isPlaying: false });
            options?.onStop?.();
            this.abortController = null;
        }
    }

    /**
     * Stops the current playback.
     */
    stop(): void {
        this.abortController?.abort();
        this.repository.setState({ isPlaying: false });
    }

    /**
     * Computes the next timestep in the sequence.
     * Pure logic - could be moved to domain service.
     */
    private computeNextTimestep(
        currentTimestep: number | undefined,
        timesteps: number[]
    ): number | null {
        if (currentTimestep === undefined) {
            return timesteps[0];
        }

        const index = timesteps.indexOf(currentTimestep);
        if (index === -1) {
            return null;
        }

        const nextIndex = (index + 1) % timesteps.length;
        return timesteps[nextIndex];
    }

    /**
     * Computes frame delay in milliseconds.
     * Pure logic - could be moved to domain service.
     */
    private computeFrameDelay(playSpeed: number): number {
        return 1000 / playSpeed;
    }

    /**
     * Waits for model loading to complete.
     */
    private async waitForModelLoading(signal: AbortSignal): Promise<void> {
        while (this.repository.isModelLoading() && !signal.aborted) {
            await this.delay(50, signal);
        }
    }

    /**
     * Delays for a specified duration, respecting abort signal.
     */
    private delay(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve) => {
            if (signal.aborted) {
                resolve();
                return;
            }

            const timeout = setTimeout(resolve, ms);
            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                resolve();
            }, { once: true });
        });
    }
}

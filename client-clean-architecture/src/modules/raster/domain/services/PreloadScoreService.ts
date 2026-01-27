/**
 * Priority models for preloading.
 */
export interface PriorityModels {
    /** Main left model */
    ml?: string;
    /** Main right model */
    mr?: string;
}

/**
 * Service for calculating preload priority scores.
 * Pure domain logic - no external dependencies.
 */
export class PreloadScoreService {
    /**
     * Calculates a priority score for preloading a frame.
     * Lower score = higher priority.
     *
     * @param timestep - Timestep number
     * @param model - Model name
     * @param currentTimestep - Currently active timestep
     * @param priorityModels - Models that should be prioritized
     * @returns Priority score (lower = higher priority)
     */
    calculateScore(
        timestep: number,
        model: string,
        currentTimestep?: number,
        priorityModels?: PriorityModels
    ): number {
        let score = 100;

        // Prioritize frames near current timestep
        if (currentTimestep !== undefined) {
            const distance = Math.abs(timestep - currentTimestep);
            score -= this.getDistanceBonus(distance);
        }

        // Prioritize main models
        if (priorityModels?.ml === model || priorityModels?.mr === model) {
            score -= 40;
        }

        // Slight bonus for dislocation model (commonly needed)
        if (model === 'dislocations') {
            score -= 10;
        }

        return score;
    }

    /**
     * Gets the bonus based on distance from current timestep.
     */
    private getDistanceBonus(distance: number): number {
        if (distance === 0) return 90;
        if (distance <= 1) return 70;
        if (distance <= 3) return 50;
        if (distance <= 5) return 30;
        return 0;
    }

    /**
     * Sorts tasks by score (ascending - lower score first).
     */
    sortByPriority<T extends { score: number }>(tasks: T[]): T[] {
        return [...tasks].sort((a, b) => a.score - b.score);
    }
}

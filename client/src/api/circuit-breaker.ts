import { CircuitState, ErrorType } from '@/types/api';
import { ApiError } from '@/api/api-error';

export interface CircuitBreakerConfig{
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
}

export class CircuitBreaker{
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime: number | null = null;

    constructor(private config: CircuitBreakerConfig){
        this.validateConfig();
    }

    private validateConfig(): void{
        if(
            this.config.failureThreshold < 1 ||
            this.config.successThreshold < 1 ||
            this.config.timeout < 100
        ){
            throw new Error('CircuitBreaker config invalid');
        }
    }

    async execute<T>(fn: () => Promise<T>): Promise<T>{
        this.updateState();

        if(this.state === CircuitState.OPEN){
            throw new ApiError(ErrorType.CIRCUIT_BREAKER_OPEN, 'The service is unavailable. Please try again later.', 503);
        }

        try{
            const result = await this.executeWithTimeout(fn);
            this.onSuccess();
            return result;
        }catch(error){
            this.onFailure();
            throw error;
        }
    }

    private executeWithTimeout<T>(fn: () => Promise<T>): Promise<T>{
        return Promise.race([
            fn(),
            new Promise<T>((_, reject) => setTimeout(() => {
                reject(new Error('Circuit breaker timeout'));
            }, this.config.resetTimeout))
        ]);
    }

    private updateState(): void{
        if(this.state === CircuitState.OPEN){
            const elapsed = Date.now() - (this.lastFailureTime || 0);
            if(elapsed > this.config.timeout){
                this.transitionToHalfOpen();
            }
        }
    }

    private onSuccess(): void{
        this.failureCount = 0;

        if(this.state === CircuitState.HALF_OPEN){
            this.successCount++;
            if(this.successCount >= this.config.successThreshold){
                this.transitionToClosed();
            }
        }
    }

    private onFailure(): void{
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.successCount = 0;

        if((this.state == CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) || this.state === CircuitState.HALF_OPEN){
            this.transitionToOpen();
        }
    }

    private transitionToClosed(): void{
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
    }

    private transitionToOpen(): void{
        this.state = CircuitState.OPEN;
        this.lastFailureTime = Date.now();
    }

    private transitionToHalfOpen(): void{
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.failureCount = 0;
    }

    getState(): CircuitState{
        this.updateState();
        return this.state;
    }
};

export const mainCircuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 10000
});
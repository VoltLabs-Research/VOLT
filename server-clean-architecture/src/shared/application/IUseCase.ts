import { Result } from '../domain/Result';

export interface IUseCase<TInput, TOutput, TError = Error>{
    execute(input: TInput): Promise<Result<TOutput, TError>>;
};
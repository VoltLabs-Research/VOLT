import { Result } from '@shared/domain/ports/Result';

export interface IUseCase<TInput, TOutput, TError = Error>{
    execute(input: TInput): Promise<Result<TOutput, TError>>;
};

export type UseCaseInput<T> = T extends IUseCase<infer I, any, any> ? I : never;
export type UseCaseOutput<T> = T extends IUseCase<any, infer O, any> ? O : never;

export type UseCaseInstance = IUseCase<any, any, any>;
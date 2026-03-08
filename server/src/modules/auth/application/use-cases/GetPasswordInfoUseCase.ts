import { GetPasswordInfoInputDTO, GetPasswordInfoOutputDTO } from '@modules/auth/application/dtos/GetPasswordInfoDTO';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class GetPasswordInfoUseCase implements IUseCase<GetPasswordInfoInputDTO, GetPasswordInfoOutputDTO, ApplicationError> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ) {}

    async execute(input: GetPasswordInfoInputDTO): Promise<Result<GetPasswordInfoOutputDTO, ApplicationError>> {
        const user = await this.userRepository.findByIdWithPassword(input.userId);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            ));
        }

        return Result.ok({
            hasPassword: !!user.password,
            lastChanged: user.props.passwordChangedAt?.toISOString()
        });
    }
};

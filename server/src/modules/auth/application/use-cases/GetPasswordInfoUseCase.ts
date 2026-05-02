import { ErrorCodes } from '@core/constants/error-codes';
import { GetPasswordInfoInputDTO, GetPasswordInfoOutputDTO } from '@modules/auth/application/dtos/GetPasswordInfoDTO';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetPasswordInfoUseCase implements IUseCase<GetPasswordInfoInputDTO, GetPasswordInfoOutputDTO, ApplicationError> {
    constructor(
        private readonly userRepository: UserRepository
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
}

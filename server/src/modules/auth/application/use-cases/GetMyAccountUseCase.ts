import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetMyAccountInputDTO, GetMyAccountOutputDTO } from '@modules/auth/application/dtos/GetMyAccountDTO';
import { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';

@injectable()
export default class GetMyAccountUseCase implements IUseCase<GetMyAccountInputDTO, GetMyAccountOutputDTO, ApplicationError> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: GetMyAccountInputDTO): Promise<Result<GetMyAccountOutputDTO, ApplicationError>> {
        const user = await this.userRepository.findById(input.userId);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            ));
        }

        const fullName = `${user.props.firstName} ${user.props.lastName}`.trim();

        return Result.ok({
            _id: user._id,
            ...user.props,
            fullName
        });
    }
};

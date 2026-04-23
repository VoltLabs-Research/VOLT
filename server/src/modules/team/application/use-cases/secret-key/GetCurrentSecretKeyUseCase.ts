import { ErrorCodes } from '@core/constants/error-codes';
import { GetCurrentSecretKeyInputDTO, GetCurrentSecretKeyOutputDTO } from '@modules/team/application/dtos/secret-key/GetCurrentSecretKeyDTO';
import SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetCurrentSecretKeyUseCase implements IUseCase<GetCurrentSecretKeyInputDTO, GetCurrentSecretKeyOutputDTO, ApplicationError> {
    constructor(
        
        private readonly secretKeyRepository: SecretKeyRepository
    ) {}

    async execute(input: GetCurrentSecretKeyInputDTO): Promise<Result<GetCurrentSecretKeyOutputDTO, ApplicationError>> {
        if (input.authType !== 'secret-key' || !input.secretKeyId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                'Secret key authentication required'
            ));
        }

        const secretKey = await this.secretKeyRepository.findById(input.secretKeyId);
        if (!secretKey) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_INVALID,
                'Secret key not found'
            ));
        }

        return Result.ok({
            _id: secretKey._id,
            team: typeof secretKey.props.team === 'string'
                ? secretKey.props.team
                : String(secretKey.props.team),
            role: secretKey.getRoleId(),
            createdBy: secretKey.getCreatedById(),
            name: secretKey.props.name,
            keyPrefix: secretKey.props.keyPrefix,
            isActive: secretKey.props.isActive,
            lastUsedAt: secretKey.props.lastUsedAt,
            createdAt: secretKey.props.createdAt,
            updatedAt: secretKey.props.updatedAt
        });
    }
};

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ContainerVncGatewayService } from '@modules/container/infrastructure/services/ContainerVncGatewayService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface GetContainerVncConnectPageInputDTO {
    teamId: string;
    containerId: string;
    token: string;
    parentOrigin: string;
};

interface GetContainerVncConnectPageOutputDTO {
    html: string;
    contentSecurityPolicy: string;
};

@injectable()
export class GetContainerVncConnectPageUseCase implements IUseCase<GetContainerVncConnectPageInputDTO, GetContainerVncConnectPageOutputDTO> {
    constructor(
        @inject(ContainerVncGatewayService)
        private readonly vncGatewayService: ContainerVncGatewayService
    ) {}

    async execute(input: GetContainerVncConnectPageInputDTO): Promise<Result<GetContainerVncConnectPageOutputDTO>> {
        if (!input.token.trim()) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        return Result.ok({
            html: this.vncGatewayService.buildConnectPage({
                teamId: input.teamId,
                containerId: input.containerId,
                token: input.token,
                parentOrigin: input.parentOrigin
            }),
            contentSecurityPolicy: this.vncGatewayService.getConnectPageSecurityPolicy()
        });
    }
};

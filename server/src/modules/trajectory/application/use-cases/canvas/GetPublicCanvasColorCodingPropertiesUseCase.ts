import type {
    GetColorCodingPropertiesInputDTO,
    GetColorCodingPropertiesOutputDTO
} from '@modules/trajectory/application/dtos/color-coding';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasColorCodingPropertiesInput extends GetColorCodingPropertiesInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasColorCodingPropertiesUseCase implements IUseCase<
    GetPublicCanvasColorCodingPropertiesInput,
    GetColorCodingPropertiesOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getColorCodingPropertiesUseCase: GetColorCodingPropertiesUseCase
    ) {}

    async execute(input: GetPublicCanvasColorCodingPropertiesInput): Promise<GetColorCodingPropertiesOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.getColorCodingPropertiesUseCase.execute(delegated);
    }
};

import type {
    GetGlobalSearchInputDTO,
    GetGlobalSearchOutputDTO
} from '@modules/dashboard/dtos/GetGlobalSearchDTO';
import GetGlobalSearchUseCase from '@modules/dashboard/use-cases/GetGlobalSearchUseCase';
import { DASHBOARD_TOKENS } from '@modules/dashboard/di/DashboardTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the dashboard module. Delegates to the
 * retained {@link GetGlobalSearchUseCase} (still consumed by the global-search
 * AI tool), unwrapping the Result to the thrown-error channel so Express 5
 * forwards typed `ApplicationError`s to the global error middleware.
 */
@Singleton(DASHBOARD_TOKENS.DashboardService)
export default class DashboardService {
    constructor(
        @inject(GetGlobalSearchUseCase) private readonly getGlobalSearchUseCase: GetGlobalSearchUseCase
    ) {}

    async getGlobalSearch(input: GetGlobalSearchInputDTO): Promise<GetGlobalSearchOutputDTO> {
        return this.getGlobalSearchUseCase.execute(input);
    }
}

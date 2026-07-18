import type { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from '@modules/session/application/dtos/GetActiveSessionsDTO';
import type { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from '@modules/session/application/dtos/GetLoginActivityDTO';
import { toPersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';
import type { RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO } from '@modules/session/application/dtos/RevokeAllSessionsDTO';
import type { RevokeSessionInputDTO } from '@modules/session/application/dtos/RevokeSessionDTO';
import GetActiveSessionsUseCase from '@modules/session/application/use-cases/GetActiveSessionsUseCase';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single HTTP-facing application service for the session module. One method
 * per HTTP operation. The cross-consumed use cases ({@link GetActiveSessionsUseCase},
 * {@link RevokeSessionUseCase}, {@link RevokeAllSessionsUseCase} — all still
 * driven by the `manage_sessions` AI tool) are retained and delegated to here,
 * unwrapping the Result error channel to thrown `ApplicationError`s so Express 5
 * forwards them to the global error middleware. `getLoginActivity` was
 * controller-only, so its logic is folded in directly.
 */
@Singleton(SESSION_TOKENS.SessionService)
export default class SessionService {
    constructor(
        @inject(SESSION_TOKENS.SessionRepository) private readonly sessionRepository: ISessionRepository,
        @inject(GetActiveSessionsUseCase) private readonly getActiveSessionsUseCase: GetActiveSessionsUseCase,
        @inject(RevokeSessionUseCase) private readonly revokeSessionUseCase: RevokeSessionUseCase,
        @inject(RevokeAllSessionsUseCase) private readonly revokeAllSessionsUseCase: RevokeAllSessionsUseCase
    ) {}

    async getActiveSessions(input: GetActiveSessionsInputDTO): Promise<GetActiveSessionsOutputDTO[]> {
        const result = await this.getActiveSessionsUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getLoginActivity(input: GetLoginActivityInputDTO): Promise<GetLoginActivityOutputDTO> {
        const sessions = await this.sessionRepository.findLoginActivity(input.userId, input.limit ?? 20);
        const activities = sessions.map((session) => toPersistedSessionDTO(session));

        return { activities };
    }

    async revokeSession(input: RevokeSessionInputDTO): Promise<void> {
        const result = await this.revokeSessionUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }
    }

    async revokeAllSessions(input: RevokeAllSessionsInputDTO): Promise<RevokeAllSessionsOutputDTO> {
        const result = await this.revokeAllSessionsUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }
}

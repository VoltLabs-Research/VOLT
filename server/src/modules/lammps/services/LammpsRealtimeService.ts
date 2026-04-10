import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { inject, injectable } from 'tsyringe';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class LammpsRealtimeService {
    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private readonly socketEmitter: ISocketEmitter
    ) {}

    emitToTeam(teamId: string, event: string, payload: Record<string, unknown>): void {
        this.socketEmitter.emitToRoom(`team:${teamId}`, event, payload);
    }

    emitToScript(scriptId: string, event: string, payload: Record<string, unknown>): void {
        this.socketEmitter.emitToRoom(this.getScriptRoom(scriptId), event, payload);
    }

    emitToExecution(executionId: string, event: string, payload: Record<string, unknown>): void {
        this.socketEmitter.emitToRoom(this.getExecutionRoom(executionId), event, payload);
    }

    getScriptRoom(scriptId: string): string {
        return `lammps-script:${scriptId}`;
    }

    getExecutionRoom(executionId: string): string {
        return `lammps-execution:${executionId}`;
    }
}

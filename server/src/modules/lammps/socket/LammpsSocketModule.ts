import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ZodError } from 'zod/v4';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager, PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';
import { LammpsRealtimeService } from '@modules/lammps/services/LammpsRealtimeService';
import { LammpsService } from '@modules/lammps/services/LammpsService';
import type {
    LammpsCloseExecutionPayload,
    LammpsCloseScriptPayload,
    LammpsOpenExecutionPayload,
    LammpsOpenScriptPayload,
    LammpsUpdateContentPayload
} from './LammpsSocketPayloads';
import {
    lammpsCloseExecutionSchema,
    lammpsCloseScriptSchema,
    lammpsOpenExecutionSchema,
    lammpsOpenScriptSchema,
    lammpsUpdateContentSchema
} from './LammpsSocketPayloads';

const PERSIST_DEBOUNCE_MS = 2_000;
const buildSaveKey = (scriptId: string, fileId: string): string => `${scriptId}:${fileId}`;

@injectable()
export default class LammpsSocketModule extends BaseSocketModule {
    public readonly name = 'LammpsSocketModule';

    private readonly saveTimers = new Map<string, NodeJS.Timeout>();

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(LammpsRealtimeService)
        private readonly realtimeService: LammpsRealtimeService,
        @inject(LammpsService)
        private readonly lammpsService: LammpsService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerOpenScript(connection);
        this.registerCloseScript(connection);
        this.registerOpenExecution(connection);
        this.registerCloseExecution(connection);
        this.registerUpdateContent(connection);
        this.wirePresenceOnDisconnect(
            connection,
            (conn) => this.getScriptRoomFromConnection(conn),
            'lammps_users_update',
            this.toPresenceUser
        );
    }

    async onShutdown(): Promise<void> {
        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer);
        }

        this.saveTimers.clear();
    }

    private registerOpenScript(connection: ISocketConnection): void {
        this.on<LammpsOpenScriptPayload>(connection.id, 'lammps_open_script', async (conn, payload) => {
            const parsed = lammpsOpenScriptSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitValidationError(conn.id, parsed.error);
                return;
            }

            if (!conn.user?.teams?.includes(parsed.data.teamId)) {
                this.emitForbidden(conn.id);
                return;
            }

            const currentScriptId = conn.data['lammpsScriptId'] as string | undefined;
            if (currentScriptId && currentScriptId !== parsed.data.scriptId) {
                const previousRoom = this.realtimeService.getScriptRoom(currentScriptId);
                await this.leaveRoom(conn.id, previousRoom);
                await this.broadcastPresence(previousRoom, 'lammps_users_update', this.toPresenceUser);
            }

            const room = this.realtimeService.getScriptRoom(parsed.data.scriptId);
            conn.data['lammpsScriptId'] = parsed.data.scriptId;
            conn.data['lammpsTeamId'] = parsed.data.teamId;

            await this.joinRoom(conn.id, room);
            await this.broadcastPresence(room, 'lammps_users_update', this.toPresenceUser);
        });
    }

    private registerCloseScript(connection: ISocketConnection): void {
        this.on<LammpsCloseScriptPayload>(connection.id, 'lammps_close_script', async (conn, payload) => {
            const parsed = lammpsCloseScriptSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitValidationError(conn.id, parsed.error);
                return;
            }

            const room = this.realtimeService.getScriptRoom(parsed.data.scriptId);
            await this.leaveRoom(conn.id, room);

            if (conn.data['lammpsScriptId'] === parsed.data.scriptId) {
                delete conn.data['lammpsScriptId'];
                delete conn.data['lammpsTeamId'];
            }

            await this.broadcastPresence(room, 'lammps_users_update', this.toPresenceUser);
        });
    }

    private registerOpenExecution(connection: ISocketConnection): void {
        this.on<LammpsOpenExecutionPayload>(connection.id, 'lammps_open_execution', async (conn, payload) => {
            const parsed = lammpsOpenExecutionSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitValidationError(conn.id, parsed.error);
                return;
            }

            if (!conn.user?.teams?.includes(parsed.data.teamId)) {
                this.emitForbidden(conn.id);
                return;
            }

            const currentExecutionId = conn.data['lammpsExecutionId'] as string | undefined;
            if (currentExecutionId && currentExecutionId !== parsed.data.executionId) {
                await this.leaveRoom(conn.id, this.realtimeService.getExecutionRoom(currentExecutionId));
            }

            conn.data['lammpsExecutionId'] = parsed.data.executionId;
            await this.joinRoom(conn.id, this.realtimeService.getExecutionRoom(parsed.data.executionId));
        });
    }

    private registerCloseExecution(connection: ISocketConnection): void {
        this.on<LammpsCloseExecutionPayload>(connection.id, 'lammps_close_execution', async (conn, payload) => {
            const parsed = lammpsCloseExecutionSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitValidationError(conn.id, parsed.error);
                return;
            }

            await this.leaveRoom(conn.id, this.realtimeService.getExecutionRoom(parsed.data.executionId));
            if (conn.data['lammpsExecutionId'] === parsed.data.executionId) {
                delete conn.data['lammpsExecutionId'];
            }
        });
    }

    private registerUpdateContent(connection: ISocketConnection): void {
        this.on<LammpsUpdateContentPayload>(connection.id, 'lammps_update_content', (conn, payload) => {
            const parsed = lammpsUpdateContentSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitValidationError(conn.id, parsed.error);
                return;
            }

            if (!conn.user?.teams?.includes(parsed.data.teamId)) {
                this.emitForbidden(conn.id);
                return;
            }

            const room = this.realtimeService.getScriptRoom(parsed.data.scriptId);
            if (!this.roomManager.isInRoom(conn.id, room)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Socket has not opened this script'
                );
                return;
            }

            this.emitToRoomExcept(conn.id, room, 'lammps_content_updated', {
                scriptId: parsed.data.scriptId,
                fileId: parsed.data.fileId,
                content: parsed.data.content,
                timestamp: parsed.data.timestamp,
                senderId: conn.user?._id
            });

            this.schedulePersist(
                parsed.data.scriptId,
                parsed.data.teamId,
                parsed.data.fileId,
                parsed.data.content,
                conn.user?._id
            );
        });
    }

    private schedulePersist(
        scriptId: string,
        teamId: string,
        fileId: string,
        content: string,
        userId?: string
    ): void {
        const saveKey = buildSaveKey(scriptId, fileId);
        const existingTimer = this.saveTimers.get(saveKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this.saveTimers.delete(saveKey);
            void this.persistContent(scriptId, teamId, fileId, content, userId);
        }, PERSIST_DEBOUNCE_MS);

        this.saveTimers.set(saveKey, timer);
    }

    private async persistContent(
        scriptId: string,
        teamId: string,
        fileId: string,
        content: string,
        userId?: string
    ): Promise<void> {
        try {
            await this.lammpsService.writeScriptFile({
                scriptId,
                teamId,
                relativePath: fileId,
                content,
                userId
            });
        } catch (error) {
            logger.error(`@lammps-socket - auto-save failed for ${scriptId}:${fileId} - ${error}`);
        }
    }

    private getScriptRoomFromConnection(connection: ISocketConnection): string | undefined {
        const scriptId = connection.data['lammpsScriptId'] as string | undefined;
        return scriptId
            ? this.realtimeService.getScriptRoom(scriptId)
            : undefined;
    }

    private emitValidationError(socketId: string, error: ZodError): void {
        this.emitErrorToSocket(
            socketId,
            ErrorCodes.VALIDATION_INVALID_INPUT,
            formatSocketValidationError(error)
        );
    }

    private emitForbidden(socketId: string): void {
        this.emitErrorToSocket(
            socketId,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            'You are not a member of this team'
        );
    }

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        isAnonymous: !connection.user
    });
}

import type { ContainerTerminalSize } from '@modules/container/domain/port/IContainerService';

export interface ContainerTerminalAttachPayload {
    containerId: string;
};

export interface ContainerTerminalAttachContext {
    containerId: string;
    userId: string;
    teamId: string;
}

export type ContainerTerminalResizePayload = ContainerTerminalSize;

export interface ContainerTerminalError {
    code: string;
    details?: string;
};

export interface ITerminalClient {
    readonly id: string;
    joinRoom(room: string): void;
    leaveRoom(room: string): void;
    emitData(data: string): void;
    emitDataToRoom(room: string, data: string): void;
    emitError(error: ContainerTerminalError): void;
    emitErrorToRoom(room: string, error: ContainerTerminalError): void;
    onInput(listener: (input: string) => void): void;
    offInput(listener: (input: string) => void): void;
    onResize(listener: (size: ContainerTerminalResizePayload) => void): void;
    offResize(listener: (size: ContainerTerminalResizePayload) => void): void;
    onDetach(listener: () => void): void;
    offDetach(listener: () => void): void;
    onDisconnect(listener: () => void): void;
    offDisconnect(listener: () => void): void;
};

export interface ITerminalService {
    attach(client: ITerminalClient, context: ContainerTerminalAttachContext): Promise<void>;
    detach(client: ITerminalClient, containerId: string): void;
};

import { injectable, inject } from 'tsyringe';
import { ISocketModule, ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { ITerminalService } from '@modules/container/domain/ports/ITerminalService';

@injectable()
export class ContainerSocketModule implements ISocketModule {
    readonly name = 'container';

    constructor(
        @inject('ITerminalService') private terminalService: ITerminalService
    ) { }

    async onInit(): Promise<void> {
        // No init logic needed yet
    }

    onConnection(connection: ISocketConnection): void {
        if (connection.nativeSocket) {
            this.terminalService.handleConnection(connection.nativeSocket);
        }
    }

    async onShutdown(): Promise<void> {
        // Cleanup if needed
    }
}

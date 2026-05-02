import { PassThrough } from 'node:stream';
import type {
    ContainerTerminalExec,
    ContainerTerminalSize,
    ContainerTerminalStream
} from '@modules/container/domain/port/IContainerService';

export class TeamClusterReverseTerminalExec implements ContainerTerminalExec {
    constructor(private readonly onResize: (size: ContainerTerminalSize) => void) {}

    async resize(size: ContainerTerminalSize): Promise<void> {
        this.onResize(size);
    }
}

export class TeamClusterReverseTerminalStream implements ContainerTerminalStream {
    public destroyed = false;

    constructor(
        private readonly stream: PassThrough,
        private readonly onWrite: (input: string) => void,
        private readonly onDestroy: () => void
    ) {}

    write(input: string): void {
        this.onWrite(input);
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.stream.destroy();
        this.onDestroy();
    }

    removeAllListeners(event?: string): void {
        if (event) {
            this.stream.removeAllListeners(event);
            return;
        }

        this.stream.removeAllListeners();
    }

    on(...args: ['data', (chunk: Buffer) => void] | ['end', () => void] | ['error', (error: Error) => void]): void {
        if (args[0] === 'data') {
            this.stream.on('data', args[1]);
            return;
        }

        if (args[0] === 'end') {
            this.stream.on('end', args[1]);
            return;
        }

        this.stream.on('error', args[1]);
    }
}

import net from 'node:net';

interface LocalRelayPortAllocatorInput {
    portStart: number;
    portEnd: number;
    exhaustedMessage: string;
};

/** Tracks and binds ephemeral local relay ports within a fixed range. */
export class LocalRelayPortAllocator {
    private readonly usedPorts = new Set<number>();

    constructor(private readonly input: LocalRelayPortAllocatorInput) {}

    reservePort(): number {
        for (let port = this.input.portStart; port <= this.input.portEnd; port += 1) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }

        throw new Error(this.input.exhaustedMessage);
    }

    releasePort(port: number): void {
        this.usedPorts.delete(port);
    }

    async listen(server: net.Server, port: number, host: string): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            let bound = false;

            const cleanup = (): void => {
                server.off('error', onError);
                server.off('listening', onListening);
            };

            const onListening = (): void => {
                bound = true;
                cleanup();
                resolve();
            };

            const onError = (error: Error): void => {
                cleanup();
                if (!bound && !server.listening) {
                    this.releasePort(port);
                }
                reject(error);
            };

            server.once('error', onError);
            server.once('listening', onListening);

            try {
                server.listen(port, host);
            } catch (error) {
                cleanup();
                if (!bound && !server.listening) {
                    this.releasePort(port);
                }
                reject(error);
            }
        });
    }

    close(server: net.Server): Promise<void> {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    reset(): void {
        this.usedPorts.clear();
    }
}

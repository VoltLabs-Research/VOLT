import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';
import { SocketChannelProcessClient } from '@/modules/container/infrastructure/connection/SocketChannelProcessClient';

const OBJECT_GATEWAY_CHANNEL = 'object-gateway';

type MessageListener = (message: unknown) => void;
type DisconnectedListener = () => void;

@Service('voltObjectGatewayConnection')
export class VoltObjectGatewayConnection {
    private channelClient: SocketChannelProcessClient | null = null;
    private registered = false;
    private readonly messageListeners: MessageListener[] = [];
    private readonly disconnectedListeners: DisconnectedListener[] = [];

    constructor(private readonly config: DaemonConfig) {}

    async start(): Promise<void> {
        if (this.channelClient) {
            return;
        }

        const channelClient = new SocketChannelProcessClient(
            this.config,
            OBJECT_GATEWAY_CHANNEL,
            'Object gateway data channel'
        );
        this.channelClient = channelClient;

        channelClient.onConnected(() => {
            this.registered = true;
            logger.info('Connected object gateway data channel to VoltCloud');
        });
        channelClient.onDisconnected(() => {
            this.registered = false;
            logger.info('Object gateway data channel disconnected');
            for (const listener of this.disconnectedListeners) {
                listener();
            }
        });
        channelClient.onError((error) => {
            logger.warn(`Object gateway data channel connection error: ${error.message}`);
        });
        channelClient.onMessage((message: unknown) => {
            for (const listener of this.messageListeners) {
                listener(message);
            }
        });

        await channelClient.start();
    }

    stop(): void {
        this.registered = false;
        this.channelClient?.stop();
        this.channelClient = null;
    }

    emitMessage(message: object): void {
        if (!this.channelClient || !this.registered) {
            logger.warn('Object gateway data channel is not connected; dropping reverse-channel message');
            return;
        }

        this.channelClient.emitMessage(message);
    }

    onMessage(listener: MessageListener): this {
        this.messageListeners.push(listener);
        return this;
    }

    onDisconnected(listener: DisconnectedListener): this {
        this.disconnectedListeners.push(listener);
        return this;
    }
}

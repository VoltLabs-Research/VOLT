import { singleton } from '@shared/application/utilities/singleton';
import { logger } from '@shared/infrastructure/logger';
import { SocketChannelProcessClient } from '@modules/container/socket/connection/SocketChannelProcessClient';
import type {
    ReverseChannelInboundMessage,
    ReverseChannelOutboundMessage
} from '@shared/contracts/channel/binary-messages';

const OBJECT_GATEWAY_CHANNEL = 'object-gateway';

type MessageListener = (message: ReverseChannelInboundMessage) => void;
type DisconnectedListener = () => void;

export class VoltObjectGatewayConnection {
    private channelClient: SocketChannelProcessClient | null = null;
    private registered = false;
    private readonly messageListeners: MessageListener[] = [];
    private readonly disconnectedListeners: DisconnectedListener[] = [];

    async start(): Promise<void> {
        if (this.channelClient) {
            return;
        }

        const channelClient = new SocketChannelProcessClient(
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
        channelClient.onMessage((message) => {
            for (const listener of this.messageListeners) {
                listener(message as ReverseChannelInboundMessage);
            }
        });

        await channelClient.start();
    }

    stop(): void {
        this.registered = false;
        this.channelClient?.stop();
        this.channelClient = null;
    }

    emitMessage(message: ReverseChannelOutboundMessage): void {
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

export const getVoltObjectGatewayConnection = singleton((): VoltObjectGatewayConnection => new VoltObjectGatewayConnection());

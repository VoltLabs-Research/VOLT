import fs from 'fs/promises';
import { injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { NetworkMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import type { NetworkMetricSnapshot } from '@modules/system/domain/contracts';

const BYTES_PER_KB = 1024;

@injectable()
export default class NetworkMetricsCollector {
    private lastNetworkCheck: NetworkMetricSnapshot | null = null;

    async collect(): Promise<NetworkMetrics> {
        try {
            const data = await fs.readFile('/proc/net/dev', 'utf8');
            const lines = data.split('\n');

            let totalRx = 0;
            let totalTx = 0;

            for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(/\s+/);
                const iface = parts[0].replace(':', '');

                if (iface === 'lo') continue;

                const rxBytes = parseInt(parts[1]) || 0;
                const txBytes = parseInt(parts[9]) || 0;

                totalRx += rxBytes;
                totalTx += txBytes;
            }

            const currentTime = Date.now();
            if (!this.lastNetworkCheck) {
                this.lastNetworkCheck = {
                    bytes: { received: totalRx, sent: totalTx },
                    timestamp: currentTime
                };
                return { incoming: 0, outgoing: 0, total: 0 };
            }

            const timeDiff = (currentTime - this.lastNetworkCheck.timestamp) / 1000;
            const bytesReceived = Math.max(0, totalRx - this.lastNetworkCheck.bytes.received);
            const bytesSent = Math.max(0, totalTx - this.lastNetworkCheck.bytes.sent);

            const incoming = timeDiff > 0 ? (bytesReceived / BYTES_PER_KB) / timeDiff : 0;
            const outgoing = timeDiff > 0 ? (bytesSent / BYTES_PER_KB) / timeDiff : 0;

            this.lastNetworkCheck = {
                bytes: { received: totalRx, sent: totalTx },
                timestamp: currentTime
            };

            return {
                incoming: Math.round(incoming * 10) / 10,
                outgoing: Math.round(outgoing * 10) / 10,
                total: Math.round((incoming + outgoing) * 10) / 10
            };
        } catch (error: unknown) {
            logger.error(`Error reading network stats: ${error}`);
            return { incoming: 0, outgoing: 0, total: 0 };
        }
    }
}

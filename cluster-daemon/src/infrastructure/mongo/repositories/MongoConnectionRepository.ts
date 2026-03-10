import { DAEMON_TOKENS } from '../../../core/tokens';
import { inject, injectable } from 'tsyringe';
import mongoose from 'mongoose';
import type { DaemonConfig } from '../../../core/config';

@injectable()
export class MongoConnectionRepository {
    constructor(
        @inject(DAEMON_TOKENS.Config)
        private readonly config: DaemonConfig
    ) {
    }

    async connect(): Promise<void> {
        if (mongoose.connection.readyState === 1) {
            return;
        }

        await mongoose.connect(this.config.mongodbUri);
    }

    async disconnect(): Promise<void> {
        if (mongoose.connection.readyState === 0) {
            return;
        }

        await mongoose.disconnect();
    }
};

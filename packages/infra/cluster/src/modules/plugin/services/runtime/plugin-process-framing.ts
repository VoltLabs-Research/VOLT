import type {
    PluginProcessRequest,
    PluginProcessResponse
} from '@shared/contracts/types/plugin-batch';


const HEADER_BYTES = 8;

export const encodePluginProcessFrame = (opId: number, request: PluginProcessRequest): Buffer[] => {
    const payload = Buffer.from(JSON.stringify(request), 'utf8');
    const header = Buffer.allocUnsafe(HEADER_BYTES);
    header.writeUInt32LE(opId, 0);
    header.writeUInt32LE(payload.byteLength, 4);
    return [header, payload];
};

export const decodePluginProcessResponse = (payload: Buffer): PluginProcessResponse =>
    payload.byteLength > 0
        ? JSON.parse(payload.toString('utf8')) as PluginProcessResponse
        : { ok: true };

export class PluginProcessFrameReader {
    private readonly header = Buffer.alloc(HEADER_BYTES);
    private headerCursor = 0;
    private payload: Buffer | null = null;
    private payloadCursor = 0;
    private opId = 0;

    public push(chunk: Buffer, onFrame: (opId: number, payload: Buffer) => void): void {
        let cursor = 0;
        while (cursor < chunk.byteLength) {
            if (this.payload === null) {
                cursor += this.readHeader(chunk, cursor);
                if (this.headerCursor < HEADER_BYTES) continue;

                this.opId = this.header.readUInt32LE(0);
                const payloadLength = this.header.readUInt32LE(4);
                this.headerCursor = 0;
                this.payloadCursor = 0;

                if (payloadLength === 0) {
                    onFrame(this.opId, Buffer.alloc(0));
                    continue;
                }
                this.payload = Buffer.allocUnsafe(payloadLength);
                continue;
            }

            const remaining = this.payload.byteLength - this.payloadCursor;
            const copyLength = Math.min(remaining, chunk.byteLength - cursor);
            chunk.copy(this.payload, this.payloadCursor, cursor, cursor + copyLength);
            this.payloadCursor += copyLength;
            cursor += copyLength;

            if (this.payloadCursor === this.payload.byteLength) {
                const payload = this.payload;
                this.payload = null;
                this.payloadCursor = 0;
                onFrame(this.opId, payload);
            }
        }
    }

    private readHeader(chunk: Buffer, cursor: number): number {
        const copyLength = Math.min(HEADER_BYTES - this.headerCursor, chunk.byteLength - cursor);
        chunk.copy(this.header, this.headerCursor, cursor, cursor + copyLength);
        this.headerCursor += copyLength;
        return copyLength;
    }
}

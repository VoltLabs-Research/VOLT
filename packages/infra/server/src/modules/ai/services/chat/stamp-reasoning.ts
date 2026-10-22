import type { ProviderMetadata, TextStreamPart, ToolSet } from 'ai';

type StreamPart = TextStreamPart<ToolSet>;

const PROVIDER = 'volt';

const withDuration = (metadata: ProviderMetadata | undefined, durationMs: number): ProviderMetadata => ({
    ...metadata,
    [PROVIDER]: {
        ...metadata?.[PROVIDER],
        durationMs
    }
});

// Stamps how long each reasoning block took, so a reloaded transcript can still say "thought for 12s".
export const stampReasoning = (source: ReadableStream<StreamPart>): ReadableStream<StreamPart> => {
    const started = new Map<string, number>();

    return source.pipeThrough(new TransformStream<StreamPart, StreamPart>({
        transform(part, controller) {
            if (part.type === 'reasoning-start') {
                started.set(part.id, Date.now());
                controller.enqueue(part);
                return;
            }

            if (part.type === 'reasoning-end') {
                const startedAt = started.get(part.id);
                started.delete(part.id);
                controller.enqueue(startedAt === undefined
                    ? part
                    : {
                        ...part,
                        providerMetadata: withDuration(part.providerMetadata, Date.now() - startedAt)
                    });
                return;
            }

            controller.enqueue(part);
        }
    }));
};

/**
 * `Sec-WebSocket-Protocol` arrives as a comma-separated list, possibly repeated
 * across several header lines. Returns `undefined` when the client asked for no
 * subprotocol, which is what the `ws` client expects in that case.
 */
export const buildWebSocketProtocolList = (
    value: string | string[] | undefined
): string[] | undefined => {
    const protocols = new Set<string>();

    for (const rawValue of Array.isArray(value) ? value : [value ?? '']) {
        for (const candidate of rawValue.split(',')) {
            const protocol = candidate.trim();
            if (protocol) {
                protocols.add(protocol);
            }
        }
    }

    return protocols.size > 0 ? [...protocols] : undefined;
};

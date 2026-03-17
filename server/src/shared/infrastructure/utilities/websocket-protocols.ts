export const readWebSocketProtocols = (value: string | string[] | undefined): string[] => {
    const rawValues = Array.isArray(value)
        ? value
        : value
            ? [value]
            : [];
    const protocols = new Set<string>();

    for (const rawValue of rawValues) {
        for (const candidate of rawValue.split(',')) {
            const protocol = candidate.trim();
            if (protocol) {
                protocols.add(protocol);
            }
        }
    }

    return [...protocols];
};

export const buildWebSocketProtocolList = (
    value: string | string[] | undefined
): string[] | undefined => {
    const protocols = readWebSocketProtocols(value);
    return protocols.length > 0 ? protocols : undefined;
};

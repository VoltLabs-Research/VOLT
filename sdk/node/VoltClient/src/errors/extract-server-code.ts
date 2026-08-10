interface ServerErrorCodeContainer {
    code?: string;
    message?: string;
    error?: string | ServerErrorCodeContainer;
    data?: string | ServerErrorCodeContainer;
    details?: string | ServerErrorCodeContainer;
};

const isServerErrorCodeContainer = (value: unknown): value is ServerErrorCodeContainer => {
    return typeof value === 'object' && value !== null;
};

const extractCandidateCode = (candidate: unknown): string | undefined => {
    if (typeof candidate === 'string') return candidate;
    if (!isServerErrorCodeContainer(candidate)) return undefined;
    return candidate.code ?? candidate.message;
};

const extractNestedCode = (data: ServerErrorCodeContainer): string | undefined => {
    const nestedCandidates = [data.error, data.data, data.details];

    for (const candidate of nestedCandidates) {
        const nestedCode = extractCandidateCode(candidate);
        if (nestedCode) return nestedCode;
    }

    return undefined;
};

export default function extractServerCode(data: unknown): string | undefined {
    if (typeof data === 'string') return data;
    if (!isServerErrorCodeContainer(data)) return undefined;
    return data.code ?? data.message ?? extractNestedCode(data);
}

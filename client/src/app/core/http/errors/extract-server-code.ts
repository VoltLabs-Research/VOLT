const ERROR_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:(?:::|:)[A-Za-z][A-Za-z0-9]*)+$/;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const normalizeCandidateCode = (value: unknown): string | undefined => {
    if(typeof value !== 'string') return undefined;

    const trimmedValue = value.trim();
    if(!trimmedValue) return undefined;

    if(ERROR_CODE_PATTERN.test(trimmedValue)){
        return trimmedValue;
    }

    return undefined;
};

const extractCandidateCode = (candidate: unknown): string | undefined => {
    const directCode = normalizeCandidateCode(candidate);
    if(directCode){
        return directCode;
    }

    if(!isRecord(candidate)) return undefined;

    return normalizeCandidateCode(candidate.code) ?? normalizeCandidateCode(candidate.message);
};

const extractNestedCode = (data: Record<string, unknown>): string | undefined => {
    const nestedCandidates = [
        data.error,
        data.data,
        data.details
    ];

    for(const candidate of nestedCandidates){
        const nestedCode = extractCandidateCode(candidate);
        if(nestedCode){
            return nestedCode;
        }
    }

    return undefined;
};

const extractServerCode = (data: unknown): string | undefined => {
    const directCode = normalizeCandidateCode(data);
    if(directCode){
        return directCode;
    }

    if(!isRecord(data)) return undefined;

    return normalizeCandidateCode(data.code)
        ?? normalizeCandidateCode(data.message)
        ?? extractNestedCode(data);
};

export default extractServerCode;

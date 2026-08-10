const UNSAFE_FILE_NAME_CHARACTERS = /[^a-zA-Z0-9._-]+/g;

export const sanitizeFileName = (value: string, fallback = 'artifact'): string => {
    const sanitized = value.replace(UNSAFE_FILE_NAME_CHARACTERS, '-');
    return sanitized.length > 0 ? sanitized : fallback;
};

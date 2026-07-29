/**
 * Extracts the filename from a Content-Disposition header, preferring the
 * RFC 5987 UTF-8 form over the quoted and bare variants.
 */
export const readFilenameFromContentDisposition = (value: string | undefined): string | undefined => {
    if(!value) return undefined;

    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if(utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const quotedMatch = value.match(/filename="([^"]+)"/i);
    if(quotedMatch?.[1]) return quotedMatch[1];

    const bareMatch = value.match(/filename=([^;]+)/i);
    return bareMatch?.[1]?.trim();
};

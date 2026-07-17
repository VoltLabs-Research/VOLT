import { sileo } from 'sileo';

interface CopyToClipboardOptions {
    successMessage?: string;
    errorMessage?: string;
};

const DEFAULT_SUCCESS_MESSAGE = 'Copied to clipboard';
const DEFAULT_ERROR_MESSAGE = 'Failed to copy to clipboard';

/** Copies text to the clipboard and shows consistent toast feedback. */
export const copyTextToClipboard = async (
    text: string,
    {
        successMessage = DEFAULT_SUCCESS_MESSAGE,
        errorMessage = DEFAULT_ERROR_MESSAGE
    }: CopyToClipboardOptions = {}
): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        sileo.success({ title: successMessage });
        return true;
    } catch {
        sileo.error({ title: errorMessage });
        return false;
    }
};

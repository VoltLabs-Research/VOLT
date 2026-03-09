interface ConfirmActionController {
    open: (options: ConfirmActionOptions) => Promise<boolean>;
};

export interface ConfirmActionOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    tone?: ConfirmActionTone;
    requireTypedText?: string;
};

export enum ConfirmActionTone {
    Default = 'default',
    Danger = 'danger'
};

let confirmActionController: ConfirmActionController | null = null;

const getConfirmDeleteMessage = (itemName: string, customMessage?: string): string => {
    if (customMessage) {
        return customMessage;
    }

    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
};

const getConfirmDeleteOptions = (itemName: string, customMessage?: string): ConfirmActionOptions => {
    return {
        title: getConfirmDeleteMessage(itemName, customMessage),
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: ConfirmActionTone.Danger
    };
};

const buildFallbackMessage = (options: ConfirmActionOptions): string => {
    if (!options.description) {
        return options.title;
    }

    return `${options.title}\n\n${options.description}`;
};

const normalizeConfirmActionOptions = (input: string | ConfirmActionOptions): ConfirmActionOptions => {
    if (typeof input === 'string') {
        return {
            title: input,
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Default
        };
    }

    return {
        confirmText: input.confirmText ?? 'Confirm',
        cancelText: input.cancelText ?? 'Cancel',
        tone: input.tone ?? ConfirmActionTone.Default,
        ...input
    };
};

export const registerConfirmActionController = (controller: ConfirmActionController): (() => void) => {
    confirmActionController = controller;

    return () => {
        if (confirmActionController === controller) {
            confirmActionController = null;
        }
    };
};

export const confirmAction = (input: string | ConfirmActionOptions): Promise<boolean> => {
    const options = normalizeConfirmActionOptions(input);

    if (!confirmActionController) {
        return Promise.resolve(window.confirm(buildFallbackMessage(options)));
    }

    return confirmActionController.open(options);
};

export const confirm = (input: string | ConfirmActionOptions): Promise<boolean> => {
    return confirmAction(input);
};

export const confirmDelete = (itemName: string, customMessage?: string): Promise<boolean> => {
    return confirmAction(getConfirmDeleteOptions(itemName, customMessage));
};

const useConfirm = () => {
    return {
        confirm,
        confirmDelete
    };
};

export default useConfirm;

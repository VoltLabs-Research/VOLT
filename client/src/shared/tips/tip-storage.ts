import type { ContextualTipId } from '@/shared/tips/tip-registry';

const SEEN_CONTEXTUAL_TIPS_KEY = 'volt:seen-contextual-tips';

export const MAX_CONTEXTUAL_TIPS_PER_SESSION = 3;

let cachedSeenTips: Set<string> | null = null;
let sessionTipCount = 0;
let activeTipId: ContextualTipId | null = null;
let activeToastId: string | null = null;

const getLocalStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage;
};

const loadSeenTips = (): Set<string> => {
    if (cachedSeenTips) {
        return cachedSeenTips;
    }

    const storage = getLocalStorage();
    if (!storage) {
        cachedSeenTips = new Set();
        return cachedSeenTips;
    }

    try {
        const rawValue = storage.getItem(SEEN_CONTEXTUAL_TIPS_KEY);
        if (!rawValue) {
            cachedSeenTips = new Set();
            return cachedSeenTips;
        }

        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            storage.removeItem(SEEN_CONTEXTUAL_TIPS_KEY);
            cachedSeenTips = new Set();
            return cachedSeenTips;
        }

        cachedSeenTips = new Set(parsed.filter((value): value is string => typeof value === 'string'));
        return cachedSeenTips;
    } catch {
        storage.removeItem(SEEN_CONTEXTUAL_TIPS_KEY);
        cachedSeenTips = new Set();
        return cachedSeenTips;
    }
};

const persistSeenTips = (tips: Set<string>): void => {
    cachedSeenTips = tips;

    const storage = getLocalStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(SEEN_CONTEXTUAL_TIPS_KEY, JSON.stringify(Array.from(tips).sort()));
    } catch {
        // Ignore storage write failures and keep the in-memory cache.
    }
};

export const hasSeenContextualTip = (tipId: ContextualTipId): boolean => {
    return loadSeenTips().has(tipId);
};

export const markContextualTipSeen = (tipId: ContextualTipId): void => {
    const nextTips = new Set(loadSeenTips());
    nextTips.add(tipId);
    persistSeenTips(nextTips);
};

export const canShowMoreContextualTipsThisSession = (): boolean => {
    return sessionTipCount < MAX_CONTEXTUAL_TIPS_PER_SESSION;
};

export const beginContextualTipDisplay = (tipId: ContextualTipId): boolean => {
    if (hasSeenContextualTip(tipId)) {
        return false;
    }

    if (!canShowMoreContextualTipsThisSession()) {
        return false;
    }

    if (activeTipId !== null) {
        return false;
    }

    activeTipId = tipId;
    activeToastId = null;
    return true;
};

export const finalizeContextualTipDisplay = (tipId: ContextualTipId, toastId: string): void => {
    if (activeTipId !== tipId) {
        return;
    }

    activeToastId = toastId;
    markContextualTipSeen(tipId);
    sessionTipCount += 1;
};

export const releaseContextualTipSlot = (tipId: ContextualTipId, toastId?: string): void => {
    if (activeTipId !== tipId) {
        return;
    }

    if (toastId && activeToastId && toastId !== activeToastId) {
        return;
    }

    activeTipId = null;
    activeToastId = null;
};

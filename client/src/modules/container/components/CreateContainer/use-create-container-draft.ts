import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
import { useEffect, useRef, useState } from 'react';
import type { ContainerConfig } from '../../contracts/forms';

const STORAGE_KEY = 'volt:create-container:draft';

export interface CreateContainerDraft {
    selectedTemplate: string | null;
    customImage: string;
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    config: ContainerConfig;
}

interface UseCreateContainerDraftInput {
    draft: CreateContainerDraft;
    onRestore: (draft: CreateContainerDraft) => void;
}

const useCreateContainerDraft = ({ draft, onRestore }: UseCreateContainerDraftInput) => {
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const onRestoreRef = useRef(onRestore);
    onRestoreRef.current = onRestore;

    const { selectedTemplate, customImage, selectedTeamId, selectedTeamClusterId, config } = draft;

    useEffect(() => {
        const rawDraft = readStoredString(STORAGE_KEY);
        if (!rawDraft) {
            return;
        }

        try {
            const { savedAt, ...restoredDraft } = JSON.parse(rawDraft) as CreateContainerDraft & { savedAt: number };
            onRestoreRef.current(restoredDraft);
            setLastSavedAt(savedAt);
        } catch {
            removeStoredValue(STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        const savedAt = Date.now();
        writeStoredString(STORAGE_KEY, JSON.stringify({
            selectedTemplate,
            customImage,
            selectedTeamId,
            selectedTeamClusterId,
            config,
            savedAt
        }));
        setLastSavedAt(savedAt);
    }, [selectedTemplate, customImage, selectedTeamId, selectedTeamClusterId, config]);

    return {
        lastSavedAt,
        clearDraft: () => removeStoredValue(STORAGE_KEY)
    };
};

export default useCreateContainerDraft;

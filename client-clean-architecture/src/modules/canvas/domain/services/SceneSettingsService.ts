export interface SceneDescriptor {
    sceneType: string;
    source: string;
    analysisId?: string;
    exposureId?: string;
}

export class SceneSettingsService {
    private readonly minPointSize = 0.1;
    private readonly maxPointSize = 5.0;

    isSameScene(a: SceneDescriptor, b: SceneDescriptor): boolean {
        return (
            a.sceneType === b.sceneType &&
            a.source === b.source &&
            a.analysisId === b.analysisId &&
            a.exposureId === b.exposureId
        );
    }

    addScene(scenes: SceneDescriptor[], scene: SceneDescriptor): SceneDescriptor[] {
        const exists = scenes.some((s) => this.isSameScene(s, scene));
        if (exists) return scenes;
        return [...scenes, scene];
    }

    removeScene(scenes: SceneDescriptor[], scene: SceneDescriptor): SceneDescriptor[] {
        return scenes.filter((s) => !this.isSameScene(s, scene));
    }

    toggleScene(scenes: SceneDescriptor[], scene: SceneDescriptor): SceneDescriptor[] {
        const exists = scenes.some((s) => this.isSameScene(s, scene));
        return exists ? this.removeScene(scenes, scene) : this.addScene(scenes, scene);
    }

    clampPointSize(multiplier: number): number {
        return Math.max(this.minPointSize, Math.min(this.maxPointSize, multiplier));
    }

    adjustPointSize(multiplier: number, delta: number): number {
        return this.clampPointSize(multiplier + delta);
    }

    clampOpacity(opacity: number): number {
        return Math.max(0, Math.min(1, opacity));
    }
}

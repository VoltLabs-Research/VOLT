/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { configurePointCloudMaterial, configureGeometry, isPointCloudObject } from '@/features/canvas/utilities/materials';
import { calculateModelBounds, calculateOptimalTransforms } from '@/features/canvas/utilities/modelUtils';
import type { ExtendedSceneState, UseGlbSceneParams } from '@/features/canvas/types';
import ReferencePointManager from '@/features/canvas/utilities/scene/reference-point-manager';
import TransformationManager from '@/features/canvas/utilities/scene/transformation-manager';
import ClippingManager from '@/features/canvas/utilities/scene/clipping-manager';
import { Group, Vector3 } from 'three';
import { GLB_CONSTANTS } from '@/features/canvas/utilities/loader';

export default class ModelSetupManager {
    constructor(
        private state: ExtendedSceneState,
        private params: UseGlbSceneParams,
        private clippingManager: ClippingManager,
        private referenceManager: ReferencePointManager,
        private transformManager: TransformationManager,
        private setModelBounds: (bounds: any) => void,
        private invalidate: () => void,
    ) { }

    updateParams(newParams: UseGlbSceneParams): void {
        this.params = newParams;
    }

    setup(model: Group): Group {
        // if (this.state.isSetup) return model;

        const bounds = calculateModelBounds({ scene: model });
        // @ts-ignore
        this.state.modelBounds = bounds;

        this.setupMaterials(model);
        this.clippingManager.applyToModel(model, this.params.sliceClippingPlanes);
        this.applyTransforms(model, bounds);

        // Solo ajustar al suelo si NO está disableAutoTransform
        if (!this.params.disableAutoTransform) {
            this.transformManager.adjustToGround(model);
        }

        model.updateMatrixWorld(true);
        const finalBounds = calculateModelBounds({ scene: model });
        this.setModelBounds(finalBounds);
        this.invalidate();
        this.state.isSetup = true;

        return model;
    }

    private setupMaterials(model: Group): void {
        const pointCloud = isPointCloudObject(model);

        if (pointCloud) {
            configurePointCloudMaterial(pointCloud);
            this.state.mesh = pointCloud;
        } else {
            configureGeometry(
                model,
                this.params.sliceClippingPlanes,
                (mesh) => (this.state.mesh = mesh)
            );
        }
    }

    private applyTransforms(model: Group, bounds: any): void {
        const { position, rotation, scale } = this.params;

        // Si disableAutoTransform está activo, NO aplicar transformaciones al modelo
        if (this.params.disableAutoTransform) {
            // Solo guardar el estado, no transformar
            this.state.currentRotation.copy(model.rotation);
            this.state.targetScale = 1;
            this.state.currentScale = 1;
            return;
        }

        if (!this.params.useFixedReference) {
            this.applyNormalTransforms(model, bounds, position, /*rotation,*/ scale);
        } else {
            this.applyFixedReferenceTransforms(model, bounds, position, rotation, scale);
        }

        this.state.currentRotation.copy(model.rotation);
        this.state.targetScale = model.scale.x;
        this.state.currentScale = model.scale.x;
    }

    private applyNormalTransforms(
        model: Group,
        bounds: any,
        position: any,
        // rotation: any,
        scale: number
    ): void {
        const optimal = calculateOptimalTransforms(bounds);

        model.position.set(
            (position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x) + optimal.position.x,
            (position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y) + optimal.position.y,
            (position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z) + optimal.position.z
        );

        /*
        model.rotation.set(
            (rotation.x ?? GLB_CONSTANTS.DEFAULT_ROTATION.x) + optimal.rotation.x,
            (rotation.y ?? GLB_CONSTANTS.DEFAULT_ROTATION.y) + optimal.rotation.y,
            (rotation.z ?? GLB_CONSTANTS.DEFAULT_ROTATION.z) + optimal.rotation.z
        );
        */

        const finalScale = scale * optimal.scale;
        model.scale.setScalar(finalScale);
    }

    private applyFixedReferenceTransforms(
        model: Group,
        bounds: any,
        position: any,
        rotation: any,
        scale: number
    ): void {
        if (this.state.referenceScaleFactor == null) {
            const { scale: scaleRef } = calculateOptimalTransforms(bounds);
            this.state.referenceScaleFactor = scaleRef;
        }

        const finalScale = scale * (this.state.referenceScaleFactor || 1);
        model.scale.setScalar(finalScale);

        model.position.set(
            position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x,
            position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y,
            position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z
        );

        model.rotation.set(
            rotation.x ?? GLB_CONSTANTS.DEFAULT_ROTATION.x,
            rotation.y ?? GLB_CONSTANTS.DEFAULT_ROTATION.y,
            rotation.z ?? GLB_CONSTANTS.DEFAULT_ROTATION.z
        );

        if (!this.state.useFixedReference) {
            this.referenceManager.setFixedReference(
                model,
                this.params.referencePoint,
                this.params.customReference
                    ? new Vector3(
                        this.params.customReference.x,
                        this.params.customReference.y,
                        this.params.customReference.z
                    ) : undefined
            );
            this.state.useFixedReference = true;
        }
    }
};

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

import { configurePointCloudMaterial, configureGeometry, isPointCloudObject } from '@/modules/canvas/infrastructure/scene/materials';
import { calculateOptimalTransforms } from '@/modules/canvas/domain/services/GeometryCalculationService';
import { ThreeJsGeometryAdapter } from '@/modules/canvas/infrastructure/adapters/ThreeJsGeometryAdapter';
import type { ExtendedSceneState, UseGlbSceneParams } from '@/types/scene';
import ReferencePointManager from '@/modules/canvas/infrastructure/scene/reference-point-manager';
import TransformationManager from '@/modules/canvas/infrastructure/scene/transformation-manager';
import ClippingManager from '@/modules/canvas/infrastructure/scene/clipping-manager';
import { Group, Vector3 } from 'three';
import { GLB_CONSTANTS } from '@/modules/canvas/infrastructure/loaders/GlbLoader';

const geometryAdapter = new ThreeJsGeometryAdapter();

export default class ModelSetupManager {
    constructor(
        private state: ExtendedSceneState,
        private params: UseGlbSceneParams,
        private clippingManager: ClippingManager,
        private referenceManager: ReferencePointManager,
        private transformManager: TransformationManager,
        private setModelBounds: (bounds: any) => void,
        private invalidate: () => void,
    ){}

    updateParams(newParams: UseGlbSceneParams): void {
        this.params = newParams;
    }

    setup(model: Group): Group {
        const bounds = geometryAdapter.extractModelBounds(model);
        this.state.modelBounds = bounds as any;

        this.setupMaterials(model);
        this.clippingManager.applyToModel(model, this.params.sliceClippingPlanes);
        this.applyTransforms(model, bounds);

        if (!this.params.disableAutoTransform) {
            this.transformManager.adjustToGround(model);
        }

        model.updateMatrixWorld(true);
        const finalBounds = geometryAdapter.extractModelBounds(model);
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

        if (this.params.disableAutoTransform) {
            this.state.currentRotation.copy(model.rotation);
            this.state.targetScale = 1;
            this.state.currentScale = 1;
            return;
        }

        if (!this.params.useFixedReference) {
            this.applyNormalTransforms(model, bounds, position, scale);
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
        scale: number
    ): void {
        const optimal = calculateOptimalTransforms(bounds);

        model.position.set(
            (position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x) + optimal.position.x,
            (position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y) + optimal.position.y,
            (position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z) + optimal.position.z
        );

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

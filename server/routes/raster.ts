/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Router } from 'express';
import * as controller from '@/controllers/raster';
import * as trajectoryMiddleware from '@/middlewares/trajectory';
import * as authMiddleware from '@/middlewares/authentication';

const router = Router();

// Usar autenticación opcional para permitir acceso público a rutas GET
router.get(
    '/:id/metadata',
    authMiddleware.optionalAuth,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.getRasterFrameMetadata
);

router.get(
    '/:id/frame-data/:timestep/:analysisId/:model',
    authMiddleware.optionalAuth,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.getRasterFrameData
);

router.get(
    '/:id/glb/',
    authMiddleware.optionalAuth,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.getRasterizedFrames
);

router.get(
    '/:id/images-archive',
    authMiddleware.optionalAuth,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.downloadRasterImagesArchive
);

// Para rutas POST, seguir requiriendo autenticación completa
router.post(
    '/:id/glb/',
    authMiddleware.protect,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.rasterizeFrames
);

export default router;
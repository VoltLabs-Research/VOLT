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

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { FilterQuery } from 'mongoose';
import { ApiTracker } from '@/models/index';
import type { IApiTracker } from '@/models/api-tracker';
import BaseController from '@/controllers/base-controller';

export default class ApiTrackerController extends BaseController<IApiTracker>{
    constructor(){
        super(ApiTracker, {
            resourceName: 'ApiTracker',
            fields: ['method', 'url', 'ip', 'userAgent', 'statusCode', 'responseTime', 'requestBody', 'queryParams', 'headers', 'createdAt']
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<IApiTracker>>{
        return { user: (req as any).user._id };
    }

    public getMyApiStats: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
        return this.getAll(req, res, next);
    };
}

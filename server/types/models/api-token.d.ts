/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

export interface ApiTokenPermissions {
    'read:trajectories': string;
    'write:trajectories': string;
    'delete:trajectories': string;
    'read:analysis': string;
    'write:analysis': string;
    'delete:analysis': string;
    'read:teams': string;
    'write:teams': string;
    'admin:all': string;
}

export type ApiTokenPermission = keyof ApiTokenPermissions;

export interface CreateApiTokenRequest {
    name: string;
    description?: string;
    permissions?: ApiTokenPermission[];
    expiresAt?: string; // ISO date string
}

export interface UpdateApiTokenRequest {
    name?: string;
    description?: string;
    permissions?: ApiTokenPermission[];
    isActive?: boolean;
}

export interface ApiTokenResponse {
    _id: string;
    name: string;
    description?: string;
    maskedToken: string;
    permissions: ApiTokenPermission[];
    expiresAt?: string;
    lastUsedAt?: string;
    isActive: boolean;
    status: 'active' | 'inactive' | 'expired';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface ApiTokenWithSecret extends ApiTokenResponse {
    token: string; // Only included when creating or regenerating
}

export interface ApiTokenStats {
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    lastUsed?: string;
}

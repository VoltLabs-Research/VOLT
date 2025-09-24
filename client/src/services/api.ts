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

import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL + '/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    
    if(token){
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    
    return config;
},(error) => {
    return Promise.reject(error);
});

export async function downloadBlob(
    url: string,
    filename: string,
    opts?: { onProgress?: (progress: number) => void }
){
    const token = localStorage.getItem('authToken');
    const res = await axios.get(url, {
        baseURL: API_BASE_URL,
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        onDownloadProgress: (evt) => {
            const total = (evt.total ?? 0);
            if(total > 0 && opts?.onProgress){
                opts.onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
            }
        }
    });
    const blob = res.data as Blob;
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
}

export async function downloadJson(
    url: string,
    filename: string,
    opts?: { onProgress?: (progress: number) => void }
){
    const token = localStorage.getItem('authToken');
    const res = await axios.get(url, {
        baseURL: API_BASE_URL,
        responseType: 'json',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        onDownloadProgress: (evt) => {
            const total = (evt.total ?? 0);
            if(total > 0 && opts?.onProgress){
                opts.onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
            }
        }
    });
    const blob = new Blob([JSON.stringify(res.data?.data ?? res.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
}

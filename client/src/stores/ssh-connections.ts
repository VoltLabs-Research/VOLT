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

import { create } from 'zustand';
import { api } from '@/api';

export interface SSHConnection {
    _id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSSHConnectionData {
    name: string;
    host: string;
    port?: number;
    username: string;
    password: string;
}

export interface UpdateSSHConnectionData {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
}

interface SSHConnectionState {
    connections: SSHConnection[];
    loading: boolean;
    error: string | null;

    fetchConnections: () => Promise<void>;
    createConnection: (data: CreateSSHConnectionData) => Promise<SSHConnection>;
    updateConnection: (id: string, data: UpdateSSHConnectionData) => Promise<SSHConnection>;
    deleteConnection: (id: string) => Promise<void>;
    testConnection: (id: string) => Promise<{ valid: boolean; error?: string }>;
}

const useSSHConnections = create<SSHConnectionState>((set, get) => ({
    connections: [],
    loading: false,
    error: null,

    async fetchConnections() {
        set({ loading: true, error: null });
        try {
            const res = await api.get<{ status: 'success', data: { connections: SSHConnection[] } }>('/ssh-connections');
            set({ connections: res.data.data.connections, loading: false });
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error fetching SSH connections';
            set({ loading: false, error: errorMessage });
        }
    },

    async createConnection(data: CreateSSHConnectionData) {
        set({ loading: true, error: null });
        try {
            const res = await api.post<{ status: 'success', data: { connection: SSHConnection } }>('/ssh-connections', data);
            const newConnection = res.data.data.connection;
            set((state) => ({
                connections: [...state.connections, newConnection],
                loading: false
            }));
            return newConnection;
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error creating SSH connection';
            set({ loading: false, error: errorMessage });
            throw new Error(errorMessage);
        }
    },

    async updateConnection(id: string, data: UpdateSSHConnectionData) {
        set({ loading: true, error: null });
        try {
            const res = await api.patch<{ status: 'success', data: { connection: SSHConnection } }>(`/ssh-connections/${id}`, data);
            const updatedConnection = res.data.data.connection;
            set((state) => ({
                connections: state.connections.map(conn =>
                    conn._id === id ? updatedConnection : conn
                ),
                loading: false
            }));
            return updatedConnection;
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error updating SSH connection';
            set({ loading: false, error: errorMessage });
            throw new Error(errorMessage);
        }
    },

    async deleteConnection(id: string) {
        set({ loading: true, error: null });
        try {
            await api.delete(`/ssh-connections/${id}`);
            set((state) => ({
                connections: state.connections.filter(conn => conn._id !== id),
                loading: false
            }));
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error deleting SSH connection';
            set({ loading: false, error: errorMessage });
            throw new Error(errorMessage);
        }
    },

    async testConnection(id: string) {
        try {
            const res = await api.post<{ status: 'success', data: { valid: boolean; error?: string } }>(`/ssh-connections/${id}/test`);
            return res.data.data;
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error testing SSH connection';
            return { valid: false, error: errorMessage };
        }
    }
}));

export default useSSHConnections;

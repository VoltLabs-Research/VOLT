import { Schema, model, Document } from 'mongoose';

export interface IServerMetrics extends Document {
  timestamp: Date;
  serverId: string;
  
  // CPU Metrics
  cpu: {
    usage: number;
    cores: number;
    loadAvg: number[];
    coresUsage?: number[];
  };
  
  // Memory Metrics
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  
  // Disk Metrics
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  
  // Network Metrics
  network: {
    incoming: number; // Mbps
    outgoing: number; // Mbps
    total: number;
  };
  
  // Response Time
  responseTime: number; // ms
  responseTimes?: {
    mongodb: number;
    redis: number;
    self: number;
    average: number;
  };
  
  // Disk Operations
  diskOperations?: {
    read: number; // MB/s
    write: number; // MB/s
    speed: number; // IOPS
  };
  
  // Status
  status: 'Healthy' | 'Warning' | 'Critical';
  uptime: number; // seconds
  
  // MongoDB Metrics (if applicable)
  mongodb?: {
    connections: number;
    queries: number;
    latency: number;
  };
  
  // Drives Info
  drives: {
    name: string;
    capacity: number; // TB
    used: number; // TB
    type: string;
  }[];
}

const ServerMetricsSchema = new Schema<IServerMetrics>({
  timestamp: { type: Date, default: Date.now, index: true },
  serverId: { type: String, required: true, index: true },
  
  cpu: {
    usage: { type: Number, required: true },
    cores: { type: Number, required: true },
    loadAvg: [{ type: Number }],
    coresUsage: [{ type: Number }]
  },
  
  memory: {
    total: { type: Number, required: true },
    used: { type: Number, required: true },
    free: { type: Number, required: true },
    usagePercent: { type: Number, required: true }
  },
  
  disk: {
    total: { type: Number, required: true },
    used: { type: Number, required: true },
    free: { type: Number, required: true },
    usagePercent: { type: Number, required: true }
  },
  
  network: {
    incoming: { type: Number, required: true },
    outgoing: { type: Number, required: true },
    total: { type: Number, required: true }
  },
  
  responseTime: { type: Number, required: true },
  responseTimes: {
    mongodb: { type: Number },
    redis: { type: Number },
    self: { type: Number },
    average: { type: Number }
  },
  diskOperations: {
    read: { type: Number },
    write: { type: Number },
    speed: { type: Number }
  },
  status: { type: String, enum: ['Healthy', 'Warning', 'Critical'], required: true },
  uptime: { type: Number, required: true },
  
  mongodb: {
    connections: { type: Number },
    queries: { type: Number },
    latency: { type: Number }
  },
  
  drives: [{
    name: { type: String },
    capacity: { type: Number },
    used: { type: Number },
    type: { type: String }
  }]
}, {
  timestamps: true
});

// Index for efficient querying
ServerMetricsSchema.index({ serverId: 1, timestamp: -1 });
ServerMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days retention

export const ServerMetrics = model<IServerMetrics>('ServerMetrics', ServerMetricsSchema);

module.exports = {
  apps: [
    {
      name: 'api',
      script: 'server.ts',
      interpreter: 'node',
      node_args: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'],
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=8192'
      },
      env_production: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=8192'
      },
      max_memory_restart: '2G',
      out_file: './logs/api.out.log',
      error_file: './logs/api.err.log',
      merge_logs: true,
      time: true
    }
  ]
};



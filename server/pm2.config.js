// pm2.config.js — Production cluster config for ServiceHub backend
// Deploy with: pm2 start pm2.config.js --env production
module.exports = {
  apps: [
    {
      name: 'servicehub-api',
      script: 'src/app.js',
      instances: 'max',        // Use all CPU cores
      exec_mode: 'cluster',    // PM2 cluster mode for zero-downtime reload
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      // Zero-downtime deployments
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/servicehub.git',
      path: '/var/www/servicehub',
      'pre-deploy-local': '',
      'post-deploy': 'cd server && npm install && pm2 reload pm2.config.js --env production',
      'pre-setup': '',
    },
  },
};

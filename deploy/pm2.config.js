module.exports = {
  apps: [{
    name: 'aplus-center',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/aplus-center',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/aplus-center/error.log',
    out_file: '/var/log/aplus-center/out.log',
    // Ensure log directory exists (create manually: mkdir -p /var/log/aplus-center)
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
}

/**
 * EC2 User Data Configuration for Static WordPress
 *
 * Defines initialization commands, software packages, and automated static export setup.
 */
export const USERDATA_CONSTANTS = {
  // Package Installation on Amazon Linux 2023
  INSTALL_PACKAGES: 'dnf install -y php php-fpm php-mysqlnd php-gd php-xml php-mbstring php-intl php-zip mariadb105-server nginx jq aws-cli wget nodejs npm rsync cronie',

  // Service Management
  ENABLE_SERVICES: 'systemctl enable --now mariadb nginx php-fpm crond',

  // Tool Installation
  INSTALL_PAGEFIND: 'npm install -g pagefind',
  INSTALL_WP_CLI: 'curl -s -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp',

  // Directory Structure
  WORDPRESS_ROOT: '/var/www/wordpress',
  STATIC_OUTPUT_ROOT: '/var/www/static',
  STATIC_PUBLISH_SCRIPT: '/usr/local/bin/publish-static.sh',
  BACKUP_SCRIPT: '/usr/local/bin/wp-backup.sh',
  RESTORE_SCRIPT: '/usr/local/bin/wp-restore.sh',
  WP_MU_PLUGINS_PATH: '/var/www/wordpress/wp-content/mu-plugins',
} as const;

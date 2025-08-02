import { Client } from 'ssh2';
import { logger } from './logger';
import fs from 'fs';

export interface SSHTunnelConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface TunnelConnection {
  localPort: number;
  close: () => void;
}

export class SSHTunnelManager {
  private static instance: SSHTunnelManager;
  private activeTunnels: Map<string, { client: Client; localPort: number }> = new Map();

  public static getInstance(): SSHTunnelManager {
    if (!SSHTunnelManager.instance) {
      SSHTunnelManager.instance = new SSHTunnelManager();
    }
    return SSHTunnelManager.instance;
  }

  private constructor() {}

  /**
   * Create an SSH tunnel for database connection
   */
  async createTunnel(
    sshConfig: SSHTunnelConfig,
    targetHost: string,
    targetPort: number
  ): Promise<TunnelConnection> {
    const tunnelKey = `${sshConfig.host}:${sshConfig.port}->${targetHost}:${targetPort}`;
    
    // Check if tunnel already exists
    if (this.activeTunnels.has(tunnelKey)) {
      const existing = this.activeTunnels.get(tunnelKey)!;
      logger.info(`Reusing existing SSH tunnel: ${tunnelKey}`);
      return {
        localPort: existing.localPort,
        close: () => this.closeTunnel(tunnelKey)
      };
    }

    return new Promise((resolve, reject) => {
      const client = new Client();
      let localPort: number;

      client.on('ready', () => {
        logger.info(`SSH connection established to ${sshConfig.host}:${sshConfig.port}`);
        
        // Find available local port
        const server = require('net').createServer();
        server.listen(0, () => {
          localPort = server.address().port;
          server.close();

          // Create the tunnel
          client.forwardOut('127.0.0.1', localPort, targetHost, targetPort, (err, stream) => {
            if (err) {
              logger.error('SSH tunnel forwarding failed:', err);
              client.end();
              reject(err);
              return;
            }

            // Store the tunnel
            this.activeTunnels.set(tunnelKey, { client, localPort });
            
            logger.info(`SSH tunnel created: localhost:${localPort} -> ${targetHost}:${targetPort}`);
            
            resolve({
              localPort,
              close: () => this.closeTunnel(tunnelKey)
            });
          });
        });
      });

      client.on('error', (err) => {
        logger.error('SSH connection error:', err);
        reject(err);
      });

      // Prepare connection config
      const connectConfig: Record<string, unknown> = {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
      };

      // Handle authentication
      if (sshConfig.privateKey) {
        try {
          let privateKey = sshConfig.privateKey;
          
          // If it looks like a file path, read the file
          if (privateKey.includes('/') || privateKey.includes('\\')) {
            if (fs.existsSync(privateKey)) {
              privateKey = fs.readFileSync(privateKey, 'utf8');
            }
          }
          
          connectConfig.privateKey = privateKey;
          if (sshConfig.passphrase) {
            connectConfig.passphrase = sshConfig.passphrase;
          }
        } catch (error) {
          logger.error('Failed to read SSH private key:', error);
          reject(new Error('Failed to read SSH private key'));
          return;
        }
      } else if (sshConfig.password) {
        connectConfig.password = sshConfig.password;
      } else {
        reject(new Error('SSH authentication method required (password or private key)'));
        return;
      }

      client.connect(connectConfig);
    });
  }

  /**
   * Close an SSH tunnel
   */
  private closeTunnel(tunnelKey: string): void {
    const tunnel = this.activeTunnels.get(tunnelKey);
    if (tunnel) {
      tunnel.client.end();
      this.activeTunnels.delete(tunnelKey);
      logger.info(`SSH tunnel closed: ${tunnelKey}`);
    }
  }

  /**
   * Close all active tunnels
   */
  closeAllTunnels(): void {
    for (const [key] of this.activeTunnels) {
      this.closeTunnel(key);
    }
  }

  /**
   * Test SSH connection without creating a tunnel
   */
  async testConnection(sshConfig: SSHTunnelConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new Client();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          client.end();
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 10000); // 10 second timeout

      client.on('ready', () => {
        clearTimeout(timeout);
        cleanup();
        resolve(true);
      });

      client.on('error', () => {
        clearTimeout(timeout);
        cleanup();
        resolve(false);
      });

      // Same connection logic as createTunnel
      const connectConfig: Record<string, unknown> = {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
      };

      if (sshConfig.privateKey) {
        try {
          let privateKey = sshConfig.privateKey;
          if (privateKey.includes('/') || privateKey.includes('\\')) {
            if (fs.existsSync(privateKey)) {
              privateKey = fs.readFileSync(privateKey, 'utf8');
            }
          }
          connectConfig.privateKey = privateKey;
          if (sshConfig.passphrase) {
            connectConfig.passphrase = sshConfig.passphrase;
          }
        } catch (error) {
          clearTimeout(timeout);
          cleanup();
          resolve(false);
          return;
        }
      } else if (sshConfig.password) {
        connectConfig.password = sshConfig.password;
      } else {
        clearTimeout(timeout);
        cleanup();
        resolve(false);
        return;
      }

      client.connect(connectConfig);
    });
  }
}
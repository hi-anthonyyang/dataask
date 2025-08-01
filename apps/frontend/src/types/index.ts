export interface Connection {
  id: string
  name: string
  type: string
  config?: {
    host?: string
    port?: number
    database?: string
    username?: string
    password?: string
    filename?: string
    // SSL Configuration
    sslEnabled?: boolean
    sslMode?: 'require' | 'prefer' | 'allow' | 'disable'
    sslCa?: string
    sslCert?: string
    sslKey?: string
    sslRejectUnauthorized?: boolean
    // Connection Timeouts
    connectionTimeout?: number
    queryTimeout?: number
    // SSH Tunnel Configuration
    sshEnabled?: boolean
    sshHost?: string
    sshPort?: number
    sshUsername?: string
    sshPassword?: string
    sshPrivateKey?: string
    sshPassphrase?: string
    // File Import Configuration
    originalFilename?: string
    fileSize?: number
    uploadedAt?: string
    rowCount?: number
    columns?: FileColumn[]
  }
}

export interface FileColumn {
  name: string
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE'
  originalType?: string
  nullable?: boolean
  sampleValues?: any[]
}

export interface FilePreview {
  filename: string
  rowCount: number
  columns: FileColumn[]
  sampleData: any[][]
  headers: string[]
  tempFilePath?: string
}
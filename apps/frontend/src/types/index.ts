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
  }
}
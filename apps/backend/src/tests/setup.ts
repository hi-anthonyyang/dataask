// Test setup for backend
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-removed'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-removed'
process.env.ENCRYPTION_KEY = 'test-encryption-key-removed'

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}
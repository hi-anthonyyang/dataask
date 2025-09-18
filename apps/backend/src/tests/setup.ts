// Test setup for backend
process.env.NODE_ENV = 'test'

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}
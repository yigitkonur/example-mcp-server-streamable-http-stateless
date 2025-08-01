// Jest setup file for Streamable HTTP Stateless server tests

// Set test environment
process.env.NODE_ENV = 'test';

// Set test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};
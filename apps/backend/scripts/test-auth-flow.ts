#!/usr/bin/env tsx

import fetch from 'node-fetch';
import { createHash, randomBytes } from 'crypto';

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

class AuthFlowTester {
  private results: TestResult[] = [];
  private cookies: string = '';

  private log(result: TestResult) {
    this.results.push(result);
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.data && process.env.DEBUG) {
      console.log('   Data:', JSON.stringify(result.data, null, 2));
    }
  }

  private extractCookies(response: any): void {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookies = setCookie;
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    includeCookies: boolean = false
  ) {
    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (includeCookies && this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Extract cookies from response
    this.extractCookies(response);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers,
    };
  }

  async testHealthCheck(): Promise<void> {
    try {
      const response = await this.makeRequest('GET', '/health');
      
      this.log({
        name: 'Health Check',
        success: response.ok,
        message: response.ok ? 'Server is running' : `Server error: ${response.status}`,
        data: response.data,
      });
    } catch (error) {
      this.log({
        name: 'Health Check',
        success: false,
        message: `Connection failed: ${error.message}`,
      });
    }
  }

  async testRegistration(): Promise<void> {
    try {
      const response = await this.makeRequest('POST', '/api/auth/register', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const success = response.status === 201 && response.data.user;
      
      this.log({
        name: 'User Registration',
        success,
        message: success 
          ? `User registered: ${response.data.user.email}` 
          : `Registration failed: ${response.data.error || response.status}`,
        data: success ? { userId: response.data.user.id } : response.data,
      });
    } catch (error) {
      this.log({
        name: 'User Registration',
        success: false,
        message: `Registration error: ${error.message}`,
      });
    }
  }

  async testLogin(): Promise<void> {
    try {
      const response = await this.makeRequest('POST', '/api/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const success = response.ok && response.data.user;
      
      this.log({
        name: 'User Login',
        success,
        message: success 
          ? `Login successful: ${response.data.user.email}` 
          : `Login failed: ${response.data.error || response.status}`,
        data: success ? { userId: response.data.user.id } : response.data,
      });
    } catch (error) {
      this.log({
        name: 'User Login',
        success: false,
        message: `Login error: ${error.message}`,
      });
    }
  }

  async testGetCurrentUser(): Promise<void> {
    try {
      const response = await this.makeRequest('GET', '/api/auth/me', undefined, true);

      const success = response.ok && response.data.user;
      
      this.log({
        name: 'Get Current User',
        success,
        message: success 
          ? `Current user: ${response.data.user.email}` 
          : `Failed to get user: ${response.data.error || response.status}`,
        data: success ? { userId: response.data.user.id } : response.data,
      });
    } catch (error) {
      this.log({
        name: 'Get Current User',
        success: false,
        message: `Get user error: ${error.message}`,
      });
    }
  }

  async testCreateConnection(): Promise<string | null> {
    try {
      const connectionData = {
              name: 'Test SQLite Connection',
      type: 'sqlite',
        config: {
          filename: '/tmp/test.db',
        },
      };

      const response = await this.makeRequest('POST', '/api/user/connections', connectionData, true);

      const success = response.status === 201 && response.data.connection;
      
      this.log({
        name: 'Create Connection',
        success,
        message: success 
          ? `Connection created: ${response.data.connection.name}` 
          : `Failed to create connection: ${response.data.error || response.status}`,
        data: success ? { connectionId: response.data.connection.id } : response.data,
      });

      return success ? response.data.connection.id : null;
    } catch (error) {
      this.log({
        name: 'Create Connection',
        success: false,
        message: `Create connection error: ${error.message}`,
      });
      return null;
    }
  }

  async testListConnections(): Promise<void> {
    try {
      const response = await this.makeRequest('GET', '/api/user/connections', undefined, true);

      const success = response.ok && Array.isArray(response.data.connections);
      
      this.log({
        name: 'List Connections',
        success,
        message: success 
          ? `Found ${response.data.connections.length} connection(s)` 
          : `Failed to list connections: ${response.data.error || response.status}`,
        data: success ? { count: response.data.connections.length } : response.data,
      });
    } catch (error) {
      this.log({
        name: 'List Connections',
        success: false,
        message: `List connections error: ${error.message}`,
      });
    }
  }

  async testUpdateConnection(connectionId: string): Promise<void> {
    try {
      const updateData = {
        name: 'Updated Test Connection',
        type: 'postgresql',
        config: {
          host: 'updated-host',
          port: 5432,
          database: 'updated_db',
          username: 'updated_user',
          password: 'updated_pass123',
        },
      };

      const response = await this.makeRequest('PUT', `/api/user/connections/${connectionId}`, updateData, true);

      const success = response.ok && response.data.connection;
      
      this.log({
        name: 'Update Connection',
        success,
        message: success 
          ? `Connection updated: ${response.data.connection.name}` 
          : `Failed to update connection: ${response.data.error || response.status}`,
        data: success ? { connectionId: response.data.connection.id } : response.data,
      });
    } catch (error) {
      this.log({
        name: 'Update Connection',
        success: false,
        message: `Update connection error: ${error.message}`,
      });
    }
  }

  async testDeleteConnection(connectionId: string): Promise<void> {
    try {
      const response = await this.makeRequest('DELETE', `/api/user/connections/${connectionId}`, undefined, true);

      const success = response.ok;
      
      this.log({
        name: 'Delete Connection',
        success,
        message: success 
          ? 'Connection deleted successfully' 
          : `Failed to delete connection: ${response.data.error || response.status}`,
        data: !success ? response.data : undefined,
      });
    } catch (error) {
      this.log({
        name: 'Delete Connection',
        success: false,
        message: `Delete connection error: ${error.message}`,
      });
    }
  }

  async testLogout(): Promise<void> {
    try {
      const response = await this.makeRequest('POST', '/api/auth/logout', undefined, true);

      const success = response.ok;
      
      this.log({
        name: 'User Logout',
        success,
        message: success 
          ? 'Logout successful' 
          : `Logout failed: ${response.data.error || response.status}`,
        data: !success ? response.data : undefined,
      });
    } catch (error) {
      this.log({
        name: 'User Logout',
        success: false,
        message: `Logout error: ${error.message}`,
      });
    }
  }

  async testInvalidLogin(): Promise<void> {
    try {
      const response = await this.makeRequest('POST', '/api/auth/login', {
        email: TEST_EMAIL,
        password: 'WrongPassword123!',
      });

      const success = response.status === 401;
      
      this.log({
        name: 'Invalid Login (Security Test)',
        success,
        message: success 
          ? 'Correctly rejected invalid credentials' 
          : `Security issue: Invalid login succeeded with status ${response.status}`,
        data: response.data,
      });
    } catch (error) {
      this.log({
        name: 'Invalid Login (Security Test)',
        success: false,
        message: `Invalid login test error: ${error.message}`,
      });
    }
  }

  async testAuthenticationFlow(): Promise<void> {
    console.log('🧪 Starting Authentication Flow Test...\n');
    console.log(`📧 Test Email: ${TEST_EMAIL}`);
    console.log(`🔑 Test Password: ${TEST_PASSWORD}\n`);

    // Test server health
    await this.testHealthCheck();

    // Test registration
    await this.testRegistration();

    // Test login
    await this.testLogin();

    // Test getting current user
    await this.testGetCurrentUser();

    // Test connection management
    const connectionId = await this.testCreateConnection();
    await this.testListConnections();
    
    if (connectionId) {
      await this.testUpdateConnection(connectionId);
      await this.testDeleteConnection(connectionId);
    }

    // Test security
    await this.testInvalidLogin();

    // Test logout
    await this.testLogout();

    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTHENTICATION FLOW TEST SUMMARY');
    console.log('='.repeat(60));

    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const percentage = Math.round((successful / total) * 100);

    console.log(`\n✅ Successful: ${successful}/${total} (${percentage}%)`);
    console.log(`❌ Failed: ${total - successful}/${total} (${100 - percentage}%)\n`);

    // Show failed tests
    const failed = this.results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('❌ Failed Tests:');
      failed.forEach(test => {
        console.log(`   - ${test.name}: ${test.message}`);
      });
      console.log('');
    }

    // Overall status
    if (successful === total) {
      console.log('🎉 ALL TESTS PASSED! Authentication system is working correctly.');
    } else if (successful >= total * 0.8) {
      console.log('⚠️  MOSTLY WORKING: Most tests passed, check failed tests above.');
    } else {
      console.log('🚨 MAJOR ISSUES: Multiple tests failed, system needs attention.');
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run the tests
async function main() {
  const tester = new AuthFlowTester();
  await tester.testAuthenticationFlow();
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { AuthFlowTester };
#!/bin/bash

# 🚀 DataAsk Production Deployment Script
# This script automates the deployment of the authentication system

set -e  # Exit on any error

echo "🚀 DataAsk Production Deployment Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_warning "Please copy env.example to .env and configure your production settings"
    exit 1
fi

# Check for required environment variables
print_status "Checking environment configuration..."

required_vars=("JWT_SECRET" "JWT_REFRESH_SECRET" "ENCRYPTION_KEY" "POSTGRES_HOST" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_warning "Please configure all required variables in .env file"
    exit 1
fi

print_success "Environment configuration validated"

# Check Node.js version
print_status "Checking Node.js version..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    print_error "Node.js 18+ required. Current version: $(node --version)"
    exit 1
fi
print_success "Node.js version: $(node --version)"

# Install dependencies
print_status "Installing dependencies..."
npm install --production
print_success "Root dependencies installed"

# Backend setup
print_status "Setting up backend..."
cd apps/backend
npm install --production
print_success "Backend dependencies installed"

# Run TypeScript compilation check
print_status "Checking TypeScript compilation..."
npm run type-check
print_success "TypeScript compilation successful"

# Build backend
print_status "Building backend..."
npm run build
print_success "Backend build successful"

# Run database migrations
print_status "Running database migrations..."
npm run migrate
print_success "Database migrations completed"

# Frontend setup
print_status "Setting up frontend..."
cd ../frontend
npm install --production
print_success "Frontend dependencies installed"

# Build frontend
print_status "Building frontend for production..."
npm run build
print_success "Frontend build successful"

# Return to root
cd ../..

# Security audit
print_status "Running security audit..."
npm audit --audit-level high
if [ $? -eq 0 ]; then
    print_success "Security audit passed - no high-severity vulnerabilities"
else
    print_warning "Security audit found issues - please review"
fi

# Test authentication endpoints (if server is running)
print_status "Testing deployment..."

# Check if server is already running
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    print_success "Server is running - testing endpoints..."
    
    # Test health endpoint
    if curl -s http://localhost:3001/health | grep -q "OK"; then
        print_success "Health endpoint responding"
    else
        print_warning "Health endpoint not responding correctly"
    fi
    
    # Test auth health endpoint
    if curl -s http://localhost:3001/api/auth/health | grep -q "OK"; then
        print_success "Auth health endpoint responding"
    else
        print_warning "Auth health endpoint not responding correctly"
    fi
else
    print_warning "Server not running - skipping endpoint tests"
    print_status "Start the server with: cd apps/backend && npm run start"
fi

# Final deployment summary
echo ""
echo "🎉 Deployment Summary:"
echo "======================"
print_success "✅ Dependencies installed and updated"
print_success "✅ TypeScript compilation successful"
print_success "✅ Backend built and ready"
print_success "✅ Frontend built for production"
print_success "✅ Database migrations applied"
print_success "✅ Security audit completed"

echo ""
echo "📋 Next Steps:"
echo "==============="
echo "1. Configure your reverse proxy (nginx/apache) to serve:"
echo "   - Frontend: apps/frontend/dist/"
echo "   - Backend API: http://localhost:3001"
echo ""
echo "2. Start the production server:"
echo "   cd apps/backend && npm run start"
echo ""
echo "3. Or use PM2 for process management:"
echo "   pm2 start apps/backend/dist/server.js --name dataask-backend"
echo ""
echo "4. Monitor logs and verify all endpoints are working"
echo ""
echo "5. Run the production checklist: PRODUCTION_CHECKLIST.md"

print_success "🚀 Deployment completed successfully!"
print_status "Your authentication system is ready for production!"

echo ""
echo "🔗 Useful commands:"
echo "==================="
echo "• Health check: curl http://localhost:3001/health"
echo "• Auth test: curl http://localhost:3001/api/auth/health"  
echo "• View logs: tail -f /var/log/dataask/app.log"
echo "• Monitor server: pm2 status"
echo ""
echo "📚 Documentation:"
echo "=================="
echo "• Production Checklist: PRODUCTION_CHECKLIST.md"
echo "• Technical Docs: AUTHENTICATION.md"
echo "• Architecture: README.md"
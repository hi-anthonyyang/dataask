#!/bin/bash

# 🚀 DataAsk Production Deployment Script
# This script automates the deployment of the CSV/Excel data analysis application

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
if [ ! -f "apps/backend/.env" ]; then
    print_error "apps/backend/.env file not found!"
    print_warning "Please copy env.example to apps/backend/.env and configure your settings"
    exit 1
fi

# Check for required environment variables
print_status "Checking environment configuration..."

required_vars=("API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" apps/backend/.env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_warning "Please configure all required variables in apps/backend/.env file"
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

# Frontend setup
print_status "Setting up frontend..."
cd ../frontend
npm install --production
print_success "Frontend dependencies installed"

# Build frontend
print_status "Building frontend..."
npm run build
print_success "Frontend build successful"

# Return to root
cd ../..

print_success "✅ DataAsk Production Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Start the backend: cd apps/backend && npm start"
echo "  2. Start the frontend: cd apps/frontend && npm start"
echo "  3. Or use: npm run dev (for development)"
echo ""
print_success "🎉 Deployment ready!"
#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/deploy.sh [staging|production] [version]
# Example: ./scripts/deploy.sh production v1.0.0

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="${DOCKER_HUB_USERNAME:-yourusername}"
FRONTEND_IMAGE="data-insight-frontend"
BACKEND_IMAGE="data-insight-backend"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Parse arguments
parse_args() {
    if [ "$#" -lt 2 ]; then
        print_error "Usage: $0 [staging|production] [version]"
        print_info "Example: $0 production v1.0.0"
        exit 1
    fi

    ENVIRONMENT=$1
    VERSION=$2

    if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
        print_error "Environment must be 'staging' or 'production'"
        exit 1
    fi

    print_info "Environment: $ENVIRONMENT"
    print_info "Version: $VERSION"
}

# Pull Docker images
pull_images() {
    print_info "Pulling Docker images..."

    FRONTEND_TAG="$DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION"
    BACKEND_TAG="$DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION"

    print_info "Pulling frontend: $FRONTEND_TAG"
    docker pull "$FRONTEND_TAG" || {
        print_error "Failed to pull frontend image"
        exit 1
    }

    print_info "Pulling backend: $BACKEND_TAG"
    docker pull "$BACKEND_TAG" || {
        print_error "Failed to pull backend image"
        exit 1
    }

    print_success "Images pulled successfully"
}

# Tag images as latest for the environment
tag_images() {
    print_info "Tagging images for $ENVIRONMENT..."

    docker tag "$DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION" "$DOCKER_USERNAME/$FRONTEND_IMAGE:$ENVIRONMENT-latest"
    docker tag "$DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION" "$DOCKER_USERNAME/$BACKEND_IMAGE:$ENVIRONMENT-latest"

    print_success "Images tagged successfully"
}

# Deploy using docker-compose
deploy_local() {
    print_info "Deploying to local environment using docker-compose..."

    # Export environment variables for docker-compose
    export DOCKER_USERNAME
    export VERSION

    # Choose the right compose file
    COMPOSE_FILE="docker-compose.prod.yml"

    print_info "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" down || true

    print_info "Starting new containers..."
    docker-compose -f "$COMPOSE_FILE" up -d

    print_success "Deployment completed"
}

# Deploy to remote server via SSH
deploy_remote() {
    print_info "Deploying to remote $ENVIRONMENT server..."

    # Check for required environment variables
    if [ "$ENVIRONMENT" = "staging" ]; then
        HOST="${STAGING_HOST}"
        SSH_KEY="${STAGING_SSH_KEY}"
    else
        HOST="${PRODUCTION_HOST}"
        SSH_KEY="${PRODUCTION_SSH_KEY}"
    fi

    if [ -z "$HOST" ]; then
        print_error "${ENVIRONMENT^^}_HOST environment variable is not set"
        exit 1
    fi

    print_info "Connecting to $HOST..."

    # Deploy via SSH
    ssh "$HOST" <<-EOF
        set -e
        cd /app

        echo "Pulling latest images..."
        docker pull $DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION
        docker pull $DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION

        echo "Stopping existing containers..."
        docker-compose down

        echo "Starting new containers..."
        export VERSION=$VERSION
        docker-compose up -d

        echo "Deployment completed on $HOST"
EOF

    print_success "Remote deployment completed"
}

# Health check
health_check() {
    print_info "Running health checks..."

    # Determine the URL based on environment
    if [ "$ENVIRONMENT" = "staging" ]; then
        URL="${STAGING_URL:-http://localhost:8000}"
    else
        URL="${PRODUCTION_URL:-http://localhost:8000}"
    fi

    print_info "Waiting for services to start..."
    sleep 10

    print_info "Checking API health at $URL/api/health..."

    RETRY_COUNT=0
    MAX_RETRIES=30

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f -s "$URL/api/health" > /dev/null; then
            print_success "Health check passed!"
            return 0
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_info "Attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying in 5s..."
        sleep 5
    done

    print_error "Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Rollback function
rollback() {
    print_warning "Rolling back deployment..."

    # Get previous version (assumes semantic versioning)
    PREVIOUS_VERSION=$(docker image ls "$DOCKER_USERNAME/$FRONTEND_IMAGE" --format "{{.Tag}}" | grep -v latest | sort -V | tail -n 2 | head -n 1)

    if [ -z "$PREVIOUS_VERSION" ]; then
        print_error "No previous version found for rollback"
        exit 1
    fi

    print_info "Rolling back to version: $PREVIOUS_VERSION"

    VERSION="$PREVIOUS_VERSION"
    pull_images
    deploy_local

    print_success "Rollback completed"
}

# Main deployment flow
main() {
    echo ""
    print_info "================================"
    print_info "Data Insights Deployment Script"
    print_info "================================"
    echo ""

    check_prerequisites
    parse_args "$@"

    # Confirmation prompt for production
    if [ "$ENVIRONMENT" = "production" ]; then
        print_warning "You are about to deploy to PRODUCTION!"
        read -p "Are you sure you want to continue? (yes/no): " CONFIRM

        if [ "$CONFIRM" != "yes" ]; then
            print_info "Deployment cancelled"
            exit 0
        fi
    fi

    pull_images
    tag_images

    # Check if remote deployment is configured
    if [ "$ENVIRONMENT" = "staging" ] && [ -n "$STAGING_HOST" ]; then
        deploy_remote
    elif [ "$ENVIRONMENT" = "production" ] && [ -n "$PRODUCTION_HOST" ]; then
        deploy_remote
    else
        deploy_local
    fi

    # Run health checks
    if ! health_check; then
        print_warning "Health check failed. Do you want to rollback? (yes/no)"
        read -p "> " ROLLBACK_CONFIRM

        if [ "$ROLLBACK_CONFIRM" = "yes" ]; then
            rollback
            health_check
        else
            print_warning "Skipping rollback. Please investigate manually."
            exit 1
        fi
    fi

    echo ""
    print_success "================================"
    print_success "Deployment completed successfully!"
    print_success "Environment: $ENVIRONMENT"
    print_success "Version: $VERSION"
    print_success "================================"
    echo ""
}

# Run main function
main "$@"

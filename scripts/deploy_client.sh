#!/bin/bash

# Client Deployment Automation Script
# This script automates the complete deployment process for a new client
# Usage: ./deploy_client.sh <client-id> [deployment-mode]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_MODES=("docker" "kubernetes" "vm" "aws" "azure")
DEFAULT_MODE="docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Client Deployment Script

USAGE:
    ./deploy_client.sh <client-id> [deployment-mode] [options]

ARGUMENTS:
    client-id           Unique identifier for the client
    deployment-mode     Deployment target (docker, kubernetes, vm, aws, azure)

OPTIONS:
    -h, --help         Show this help message
    -c, --create       Create client configuration if it doesn't exist
    -f, --force        Force deployment even if client exists
    -d, --dry-run      Show what would be deployed without executing
    -e, --env FILE     Load environment variables from file
    -p, --profile PROF Use specific deployment profile
    --skip-build       Skip building Docker images
    --skip-tests       Skip running tests
    --skip-health      Skip health checks

DEPLOYMENT MODES:
    docker             Docker Compose deployment (default)
    kubernetes         Kubernetes deployment with Helm
    vm                 Virtual machine deployment
    aws                AWS deployment with CloudFormation
    azure              Azure deployment with ARM templates

EXAMPLES:
    # Deploy to Docker with default settings
    ./deploy_client.sh acme-corp

    # Deploy to Kubernetes with custom environment
    ./deploy_client.sh acme-corp kubernetes -e prod.env

    # Create new client and deploy
    ./deploy_client.sh new-client docker --create

    # Dry run to see what would be deployed
    ./deploy_client.sh acme-corp --dry-run

ENVIRONMENT VARIABLES:
    Required:
        SUPABASE_URL              Supabase project URL
        SUPABASE_SERVICE_KEY      Supabase service key
        GROQ_API_KEY             Groq API key

    Optional:
        OPENAI_API_KEY           OpenAI API key (fallback)
        REDIS_URL                Redis connection URL
        SENTRY_DSN               Sentry monitoring DSN
        
    Client-specific:
        CLIENT_DOMAIN            Custom domain for client
        SSL_CERT_PATH            SSL certificate path
        BACKUP_STRATEGY          Backup configuration

EOF
}

# Validation functions
validate_client_id() {
    local client_id="$1"
    
    if [[ ! "$client_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Invalid client ID: $client_id"
        log_error "Client ID must contain only alphanumeric characters, hyphens, and underscores"
        return 1
    fi
    
    if [ ${#client_id} -gt 50 ]; then
        log_error "Client ID too long: $client_id (max 50 characters)"
        return 1
    fi
    
    return 0
}

validate_deployment_mode() {
    local mode="$1"
    
    for valid_mode in "${DEPLOYMENT_MODES[@]}"; do
        if [ "$mode" = "$valid_mode" ]; then
            return 0
        fi
    done
    
    log_error "Invalid deployment mode: $mode"
    log_error "Valid modes: ${DEPLOYMENT_MODES[*]}"
    return 1
}

check_prerequisites() {
    local mode="$1"
    local missing_tools=()
    
    # Common tools
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    
    # Mode-specific tools
    case "$mode" in
        "kubernetes")
            command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
            command -v helm >/dev/null 2>&1 || missing_tools+=("helm")
            ;;
        "aws")
            command -v aws >/dev/null 2>&1 || missing_tools+=("aws")
            ;;
        "azure")
            command -v az >/dev/null 2>&1 || missing_tools+=("az")
            ;;
    esac
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    return 0
}

check_environment() {
    local required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_KEY" "GROQ_API_KEY")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_error "Set these variables or use --env to load from file"
        return 1
    fi
    
    return 0
}

# Client management
create_client_config() {
    local client_id="$1"
    
    log_info "Creating client configuration for $client_id"
    
    python3 "$SCRIPT_DIR/create_client.py" create "$client_id" "$client_id Company" \
        --industry="$INDUSTRY" \
        --language="$LANGUAGE" \
        --country="$COUNTRY"
    
    if [ $? -eq 0 ]; then
        log_success "Client configuration created successfully"
        return 0
    else
        log_error "Failed to create client configuration"
        return 1
    fi
}

validate_client_config() {
    local client_id="$1"
    local client_dir="$PROJECT_ROOT/clients/$client_id"
    
    if [ ! -d "$client_dir" ]; then
        log_error "Client configuration not found: $client_dir"
        return 1
    fi
    
    # Check required files
    local required_files=(
        "config/client.yaml"
        "config/rag.yaml"
        "prompts/system_default.txt"
        "assets/logo.svg"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$client_dir/$file" ]; then
            log_warning "Missing client file: $file"
        fi
    done
    
    log_success "Client configuration validated"
    return 0
}

# Deployment functions
deploy_docker() {
    local client_id="$1"
    
    log_info "Deploying $client_id using Docker Compose"
    
    # Set up environment
    export CLIENT_ID="$client_id"
    export COMPOSE_PROJECT_NAME="rag-$client_id"
    
    # Build and deploy
    if [ "$SKIP_BUILD" != "true" ]; then
        log_info "Building Docker images..."
        docker-compose -f "$PROJECT_ROOT/docker/docker-compose.client.yml" build
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "Dry run - would execute:"
        echo "docker-compose -f $PROJECT_ROOT/docker/docker-compose.client.yml up -d"
        return 0
    fi
    
    log_info "Starting services..."
    docker-compose -f "$PROJECT_ROOT/docker/docker-compose.client.yml" up -d
    
    # Wait for services to start
    log_info "Waiting for services to start..."
    sleep 30
    
    # Health check
    if [ "$SKIP_HEALTH" != "true" ]; then
        check_health_docker "$client_id"
    fi
    
    log_success "Docker deployment completed for $client_id"
    
    # Show access information
    show_deployment_info_docker "$client_id"
}

deploy_kubernetes() {
    local client_id="$1"
    
    log_info "Deploying $client_id to Kubernetes"
    
    # Create namespace
    kubectl create namespace "rag-$client_id" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy using Helm
    helm upgrade --install "rag-$client_id" "$PROJECT_ROOT/helm/rag-platform" \
        --namespace "rag-$client_id" \
        --set clientId="$client_id" \
        --set supabase.url="$SUPABASE_URL" \
        --set supabase.serviceKey="$SUPABASE_SERVICE_KEY" \
        --set groq.apiKey="$GROQ_API_KEY" \
        --wait
    
    log_success "Kubernetes deployment completed for $client_id"
}

deploy_vm() {
    local client_id="$1"
    
    log_info "Preparing VM deployment for $client_id"
    
    # Create deployment package
    local deploy_dir="/tmp/rag-deploy-$client_id"
    mkdir -p "$deploy_dir"
    
    # Copy necessary files
    cp -r "$PROJECT_ROOT/backend" "$deploy_dir/"
    cp -r "$PROJECT_ROOT/frontend" "$deploy_dir/"
    cp -r "$PROJECT_ROOT/clients/$client_id" "$deploy_dir/client-config"
    cp "$PROJECT_ROOT/scripts/vm-install.sh" "$deploy_dir/"
    
    # Create environment file
    cat > "$deploy_dir/.env" << EOF
CLIENT_ID=$client_id
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
GROQ_API_KEY=$GROQ_API_KEY
EOF
    
    # Create deployment archive
    tar -czf "rag-$client_id-deployment.tar.gz" -C "/tmp" "rag-deploy-$client_id"
    
    log_success "VM deployment package created: rag-$client_id-deployment.tar.gz"
    log_info "Copy this file to your target VM and run: tar -xzf rag-$client_id-deployment.tar.gz && cd rag-deploy-$client_id && ./vm-install.sh"
}

# Health check functions
check_health_docker() {
    local client_id="$1"
    local max_attempts=30
    local attempt=1
    
    log_info "Performing health checks..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:8000/health" > /dev/null; then
            log_success "Backend health check passed"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Backend health check failed after $max_attempts attempts"
            return 1
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for backend..."
        sleep 10
        ((attempt++))
    done
    
    # Check configuration endpoint
    if curl -f -s "http://localhost:8000/api/v1/config/current" > /dev/null; then
        log_success "Configuration endpoint accessible"
    else
        log_warning "Configuration endpoint not accessible"
    fi
    
    return 0
}

# Information display
show_deployment_info_docker() {
    local client_id="$1"
    
    cat << EOF

${GREEN}=== Deployment Complete ===${NC}

Client ID: $client_id
Deployment Mode: Docker Compose

Services:
  • Backend API: http://localhost:8000
  • Frontend: http://localhost:3000 (if enabled)
  • Redis: localhost:6379
  • Health Check: http://localhost:8000/health

Configuration:
  • Client Config: $PROJECT_ROOT/clients/$client_id/
  • Logs: docker logs rag-$client_id
  • Environment: CLIENT_ID=$client_id

Management Commands:
  • View logs: docker-compose -f docker/docker-compose.client.yml logs -f
  • Stop services: docker-compose -f docker/docker-compose.client.yml down
  • Restart: docker-compose -f docker/docker-compose.client.yml restart

Documentation: See README.md for detailed configuration options.

EOF
}

run_tests() {
    local client_id="$1"
    
    if [ "$SKIP_TESTS" = "true" ]; then
        log_info "Skipping tests (--skip-tests specified)"
        return 0
    fi
    
    log_info "Running deployment tests for $client_id..."
    
    # Run backend tests
    cd "$PROJECT_ROOT/backend"
    python -m pytest tests/ -v --tb=short
    
    # Run client-specific tests
    if [ -f "$PROJECT_ROOT/clients/$client_id/tests.py" ]; then
        log_info "Running client-specific tests..."
        python "$PROJECT_ROOT/clients/$client_id/tests.py"
    fi
    
    log_success "Tests completed successfully"
}

# Main deployment function
deploy_client() {
    local client_id="$1"
    local deployment_mode="$2"
    
    log_info "Starting deployment for client: $client_id (mode: $deployment_mode)"
    
    # Validate client configuration
    if [ ! -d "$PROJECT_ROOT/clients/$client_id" ]; then
        if [ "$CREATE_CLIENT" = "true" ]; then
            create_client_config "$client_id" || return 1
        else
            log_error "Client configuration not found. Use --create to create it."
            return 1
        fi
    fi
    
    validate_client_config "$client_id" || return 1
    
    # Run tests
    run_tests "$client_id" || return 1
    
    # Deploy based on mode
    case "$deployment_mode" in
        "docker")
            deploy_docker "$client_id"
            ;;
        "kubernetes")
            deploy_kubernetes "$client_id"
            ;;
        "vm")
            deploy_vm "$client_id"
            ;;
        "aws"|"azure")
            log_error "$deployment_mode deployment not yet implemented"
            return 1
            ;;
        *)
            log_error "Unknown deployment mode: $deployment_mode"
            return 1
            ;;
    esac
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--create)
                CREATE_CLIENT="true"
                shift
                ;;
            -f|--force)
                FORCE_DEPLOYMENT="true"
                shift
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -e|--env)
                ENV_FILE="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            --skip-health)
                SKIP_HEALTH="true"
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                exit 1
                ;;
            *)
                if [ -z "$CLIENT_ID" ]; then
                    CLIENT_ID="$1"
                elif [ -z "$DEPLOYMENT_MODE" ]; then
                    DEPLOYMENT_MODE="$1"
                else
                    log_error "Too many arguments"
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# Main function
main() {
    # Default values
    CLIENT_ID=""
    DEPLOYMENT_MODE="$DEFAULT_MODE"
    CREATE_CLIENT="false"
    FORCE_DEPLOYMENT="false"
    DRY_RUN="false"
    ENV_FILE=""
    SKIP_BUILD="false"
    SKIP_TESTS="false"
    SKIP_HEALTH="false"
    
    # Default client creation settings
    INDUSTRY="${INDUSTRY:-general}"
    LANGUAGE="${LANGUAGE:-fr}"
    COUNTRY="${COUNTRY:-FR}"
    
    # Parse arguments
    parse_args "$@"
    
    # Validate required arguments
    if [ -z "$CLIENT_ID" ]; then
        log_error "Client ID is required"
        show_help
        exit 1
    fi
    
    # Load environment file if specified
    if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
        log_info "Loading environment from $ENV_FILE"
        export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    fi
    
    # Validate inputs
    validate_client_id "$CLIENT_ID" || exit 1
    validate_deployment_mode "$DEPLOYMENT_MODE" || exit 1
    
    # Check prerequisites
    check_prerequisites "$DEPLOYMENT_MODE" || exit 1
    check_environment || exit 1
    
    # Deploy
    if deploy_client "$CLIENT_ID" "$DEPLOYMENT_MODE"; then
        log_success "Deployment completed successfully for $CLIENT_ID"
        exit 0
    else
        log_error "Deployment failed for $CLIENT_ID"
        exit 1
    fi
}

# Run main function
main "$@"
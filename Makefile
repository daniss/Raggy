# Raggy - Local Development Makefile
# Simplifies common development tasks for the RAG system

.PHONY: help install install-dev test test-coverage test-integration lint format type-check docker-up docker-down docker-logs docker-build db-setup db-migrate db-reset load-demo purge-demo health-check clean

# Default target
help:
	@echo "🔧 Raggy Development Makefile"
	@echo ""
	@echo "📦 Setup Commands:"
	@echo "  install         Install production dependencies"
	@echo "  install-dev     Install development dependencies"
	@echo ""
	@echo "🧪 Testing Commands:"
	@echo "  test           Run all tests"
	@echo "  test-coverage  Run tests with coverage report"
	@echo "  test-integration  Run integration tests only"
	@echo "  test-demo      Run demo flow tests"
	@echo "  test-purge     Run purge functionality tests"
	@echo ""
	@echo "🔍 Code Quality Commands:"
	@echo "  lint           Run linting (flake8)"
	@echo "  format         Format code (black)"
	@echo "  type-check     Run type checking (mypy)"
	@echo ""
	@echo "🐳 Docker Commands:"
	@echo "  docker-up      Start all services (development)"
	@echo "  docker-up-prod Start all services (production)"
	@echo "  docker-down    Stop all services"
	@echo "  docker-logs    View service logs"
	@echo "  docker-build   Rebuild Docker images"
	@echo ""
	@echo "🗄️  Database Commands:"
	@echo "  db-setup       Initialize database and extensions"
	@echo "  db-migrate     Apply database migrations"
	@echo "  db-reset       Reset database (⚠️  destructive)"
	@echo ""
	@echo "📚 Demo Commands:"
	@echo "  load-demo      Load demo corpus"
	@echo "  purge-demo     Purge demo data"
	@echo "  demo-stats     Show demo corpus statistics"
	@echo ""
	@echo "🏥 Health & Maintenance:"
	@echo "  health-check   Check service health"
	@echo "  clean          Clean temporary files"
	@echo ""

# Variables
BACKEND_DIR := backend
FRONTEND_DIR := frontend
PYTHON := python3
PIP := pip3
NPM := npm

# Python virtual environment
VENV := $(BACKEND_DIR)/venv
PYTHON_VENV := $(VENV)/bin/python
PIP_VENV := $(VENV)/bin/pip

# ==============================================
# Setup Commands
# ==============================================

install: install-backend install-frontend
	@echo "✅ Installation complete"

install-dev: install-backend-dev install-frontend
	@echo "✅ Development installation complete"

install-backend:
	@echo "📦 Installing backend dependencies..."
	cd $(BACKEND_DIR) && $(PYTHON) -m venv venv
	cd $(BACKEND_DIR) && $(VENV)/bin/pip install --upgrade pip
	cd $(BACKEND_DIR) && $(VENV)/bin/pip install -r requirements.txt

install-backend-dev: install-backend
	@echo "🛠️  Installing development dependencies..."
	cd $(BACKEND_DIR) && $(VENV)/bin/pip install pytest pytest-asyncio pytest-cov black flake8 mypy types-requests

install-frontend:
	@echo "📦 Installing frontend dependencies..."
	cd $(FRONTEND_DIR) && $(NPM) install

# ==============================================
# Testing Commands
# ==============================================

test: test-backend test-frontend
	@echo "✅ All tests completed"

test-backend:
	@echo "🧪 Running backend tests..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pytest tests/ -v

test-frontend:
	@echo "🧪 Running frontend tests..."
	cd $(FRONTEND_DIR) && $(NPM) run test || echo "⚠️  Frontend tests not configured"

test-coverage:
	@echo "📊 Running tests with coverage..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pytest tests/ -v --cov=app --cov-report=html --cov-report=term-missing
	@echo "📄 Coverage report generated at $(BACKEND_DIR)/htmlcov/index.html"

test-integration:
	@echo "🔗 Running integration tests..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pytest tests/test_demo_flow.py tests/test_purge.py -v -m "not unit"

test-demo:
	@echo "🎭 Running demo flow tests..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pytest tests/test_demo_flow.py -v

test-purge:
	@echo "🔥 Running purge functionality tests..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pytest tests/test_purge.py -v

# ==============================================
# Code Quality Commands
# ==============================================

lint:
	@echo "🔍 Running linting..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m flake8 app --max-line-length=120 --extend-ignore=E203,W503
	cd $(FRONTEND_DIR) && $(NPM) run lint || echo "⚠️  Frontend linting not configured"

format:
	@echo "🎨 Formatting code..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m black app --line-length=120
	cd $(FRONTEND_DIR) && $(NPM) run format || echo "⚠️  Frontend formatting not configured"

type-check:
	@echo "🔢 Running type checking..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m mypy app --ignore-missing-imports
	cd $(FRONTEND_DIR) && $(NPM) run type-check || echo "⚠️  Frontend type checking not configured"

# ==============================================
# Docker Commands
# ==============================================

docker-up:
	@echo "🐳 Starting development services..."
	docker-compose up -d
	@echo "✅ Services started. Frontend: http://localhost:3000, Backend: http://localhost:8000"

docker-up-prod:
	@echo "🐳 Starting production services..."
	docker-compose -f docker-compose.prod.yml up -d
	@echo "✅ Production services started"

docker-down:
	@echo "🛑 Stopping all services..."
	docker-compose down
	docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

docker-logs:
	@echo "📄 Viewing service logs..."
	docker-compose logs -f

docker-build:
	@echo "🔨 Rebuilding Docker images..."
	docker-compose build
	docker-compose -f docker-compose.prod.yml build

# ==============================================
# Database Commands
# ==============================================

db-setup:
	@echo "🗄️  Setting up database..."
	@echo "Creating database extensions..."
	docker-compose exec db psql -U postgres -d raggy_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
	docker-compose exec db psql -U postgres -d raggy_db -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
	@echo "✅ Database setup complete"

db-migrate:
	@echo "🔄 Applying database migrations..."
	# Add migration logic here when available
	@echo "⚠️  No migrations configured yet"

db-reset:
	@echo "⚠️  This will delete ALL data. Press Ctrl+C to cancel, or wait 5 seconds..."
	@sleep 5
	@echo "🔥 Resetting database..."
	docker-compose down
	docker volume rm raggy_postgres_data 2>/dev/null || true
	docker-compose up -d db
	@sleep 10
	$(MAKE) db-setup
	@echo "✅ Database reset complete"

# ==============================================
# Demo Commands
# ==============================================

load-demo:
	@echo "📚 Loading demo corpus..."
	$(PYTHON) scripts/load_demo_corpus.py --verbose
	@echo "✅ Demo corpus loaded"

purge-demo:
	@echo "🔥 Purging demo data..."
	./scripts/purge_demo.sh
	@echo "✅ Demo data purged"

demo-stats:
	@echo "📊 Demo corpus statistics..."
	$(PYTHON) scripts/load_demo_corpus.py --stats

# ==============================================
# Health & Maintenance Commands
# ==============================================

health-check:
	@echo "🏥 Checking service health..."
	@echo "Backend health:"
	@curl -s http://localhost:8000/health | $(PYTHON) -m json.tool || echo "❌ Backend not responding"
	@echo ""
	@echo "Frontend health:"
	@curl -s http://localhost:3000/health | $(PYTHON) -m json.tool || echo "❌ Frontend not responding"
	@echo ""
	@echo "Demo health:"
	@curl -s http://localhost:3000/demo/health | $(PYTHON) -m json.tool || echo "❌ Demo not responding"

clean:
	@echo "🧹 Cleaning temporary files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name ".pytest_cache" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "htmlcov" -delete
	find . -type d -name ".mypy_cache" -delete
	cd $(FRONTEND_DIR) && rm -rf .next node_modules/.cache 2>/dev/null || true
	@echo "✅ Cleanup complete"

# ==============================================
# Development Shortcuts
# ==============================================

dev: docker-up
	@echo "🚀 Development environment started"
	@echo "📱 Frontend: http://localhost:3000"
	@echo "🔧 Backend: http://localhost:8000"
	@echo "📖 API Docs: http://localhost:8000/docs"
	@echo "🎭 Demo: http://localhost:3000/demo"

stop: docker-down

restart: docker-down docker-up

logs: docker-logs

# CI simulation
ci: install-dev lint type-check test-coverage
	@echo "✅ CI checks passed"

# Quick quality check
check: lint type-check test
	@echo "✅ Quality checks passed"

# ==============================================
# Advanced Commands
# ==============================================

# Database backup
backup:
	@echo "💾 Creating database backup..."
	mkdir -p backups
	docker-compose exec -T db pg_dump -U postgres raggy_db > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created in backups/"

# Database restore
restore:
	@if [ -z "$(FILE)" ]; then echo "❌ Usage: make restore FILE=backups/backup_file.sql"; exit 1; fi
	@echo "🔄 Restoring database from $(FILE)..."
	docker-compose exec -T db psql -U postgres raggy_db < $(FILE)
	@echo "✅ Database restored"

# Generate requirements.txt from installed packages
freeze:
	@echo "📋 Generating requirements.txt..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pip freeze > requirements.txt
	@echo "✅ Requirements updated"

# Security scan
security:
	@echo "🔒 Running security scan..."
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pip install safety bandit || true
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m safety check || true
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -m bandit -r app || true

# Performance benchmark
benchmark:
	@echo "🏃 Running performance benchmarks..."
	# Add benchmark commands here
	@echo "⚠️  Benchmarks not implemented yet"
#!/bin/bash

# Test Deployment Script
# Comprehensive testing of Raggy deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_URL=${API_URL:-http://localhost:8000}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
TIMEOUT=30
TEST_RESULTS=()

echo -e "${GREEN}=== Raggy Deployment Testing Suite ===${NC}"
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Timestamp: $(date)"
echo ""

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=${3:-0}
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" >/dev/null 2>&1; then
        if [ $? -eq $expected_result ]; then
            echo -e "${GREEN}✓ PASS${NC}"
            TEST_RESULTS+=("PASS: $test_name")
        else
            echo -e "${RED}✗ FAIL${NC}"
            TEST_RESULTS+=("FAIL: $test_name")
        fi
    else
        echo -e "${RED}✗ FAIL${NC}"
        TEST_RESULTS+=("FAIL: $test_name")
    fi
}

# Function to test HTTP endpoint
test_http() {
    local endpoint=$1
    local expected_status=${2:-200}
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$endpoint" 2>/dev/null || echo "000")
    [ "$status" = "$expected_status" ]
}

# Function to test service availability
test_service() {
    local service=$1
    local port=$2
    local host=${3:-localhost}
    
    timeout $TIMEOUT bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null
}

echo -e "${YELLOW}=== Infrastructure Tests ===${NC}"

# Test core services
run_test "PostgreSQL connection" "test_service postgres 5432"
run_test "Redis connection" "test_service redis 6379"
run_test "Backend API port" "test_service backend 8000"
run_test "Frontend port" "test_service frontend 3000"

echo ""
echo -e "${YELLOW}=== API Health Tests ===${NC}"

# Test API endpoints
run_test "Health endpoint" "test_http $API_URL/health"
run_test "API root" "test_http $API_URL/"
run_test "OpenAPI docs" "test_http $API_URL/docs"
run_test "OpenAPI spec" "test_http $API_URL/openapi.json"

echo ""
echo -e "${YELLOW}=== Frontend Tests ===${NC}"

# Test frontend
run_test "Landing page" "test_http $FRONTEND_URL"
run_test "Demo page" "test_http $FRONTEND_URL/demo"
run_test "Assistant page" "test_http $FRONTEND_URL/assistant"

echo ""
echo -e "${YELLOW}=== RAG Pipeline Tests ===${NC}"

# Test document upload
test_upload() {
    local test_file="/tmp/test_document.txt"
    echo "This is a test document for RAG testing." > $test_file
    
    local response=$(curl -s -X POST \
        -H "Content-Type: multipart/form-data" \
        -F "file=@$test_file" \
        "$API_URL/api/v1/upload" \
        --max-time $TIMEOUT 2>/dev/null)
    
    rm -f $test_file
    echo "$response" | grep -q "success\|id\|filename" && return 0 || return 1
}

run_test "Document upload" "test_upload"

# Test chat endpoint
test_chat() {
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"question": "Hello, test question"}' \
        "$API_URL/api/v1/chat" \
        --max-time $TIMEOUT 2>/dev/null)
    
    echo "$response" | grep -q "answer\|response\|message" && return 0 || return 1
}

run_test "Chat endpoint" "test_chat"

# Test streaming chat
test_chat_stream() {
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"question": "Test streaming"}' \
        "$API_URL/api/v1/chat/stream" \
        --max-time $TIMEOUT 2>/dev/null | head -n 1)
    
    [ -n "$response" ] && return 0 || return 1
}

run_test "Streaming chat" "test_chat_stream"

echo ""
echo -e "${YELLOW}=== Database Tests ===${NC}"

# Test database connectivity
test_db_connection() {
    local health_response=$(curl -s "$API_URL/health" --max-time $TIMEOUT 2>/dev/null)
    echo "$health_response" | grep -q "supabase.*connected\|database.*connected" && return 0 || return 1
}

run_test "Database connection" "test_db_connection"

# Test vector database
test_vector_db() {
    local health_response=$(curl -s "$API_URL/health" --max-time $TIMEOUT 2>/dev/null)
    echo "$health_response" | grep -q "vector_store.*connected" && return 0 || return 1
}

run_test "Vector database" "test_vector_db"

echo ""
echo -e "${YELLOW}=== Performance Tests ===${NC}"

# Test response time
test_response_time() {
    local start_time=$(date +%s%N)
    curl -s "$API_URL/health" --max-time $TIMEOUT >/dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
    
    [ $duration -lt 2000 ] && return 0 || return 1 # Under 2 seconds
}

run_test "Response time < 2s" "test_response_time"

# Test concurrent requests
test_concurrent() {
    local pids=()
    for i in {1..5}; do
        curl -s "$API_URL/health" --max-time $TIMEOUT >/dev/null 2>&1 &
        pids+=($!)
    done
    
    local success=true
    for pid in "${pids[@]}"; do
        if ! wait $pid; then
            success=false
        fi
    done
    
    $success && return 0 || return 1
}

run_test "Concurrent requests" "test_concurrent"

echo ""
echo -e "${YELLOW}=== Security Tests ===${NC}"

# Test unauthorized access
run_test "Unauthorized access blocked" "test_http $API_URL/api/v1/admin/restricted 401"

# Test rate limiting (if enabled)
test_rate_limiting() {
    local status_codes=()
    for i in {1..10}; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null)
        status_codes+=($status)
    done
    
    # All should succeed in test environment
    for code in "${status_codes[@]}"; do
        [ "$code" != "200" ] && return 1
    done
    return 0
}

run_test "Rate limiting (info)" "test_rate_limiting"

echo ""
echo -e "${YELLOW}=== Integration Tests ===${NC}"

# Test full RAG workflow
test_full_workflow() {
    # Create test document
    local test_file="/tmp/workflow_test.txt"
    echo -e "Company Policy:\nRemote work is allowed up to 3 days per week.\nEmployees must inform their manager 24 hours in advance." > $test_file
    
    # Upload document
    local upload_response=$(curl -s -X POST \
        -H "Content-Type: multipart/form-data" \
        -F "file=@$test_file" \
        "$API_URL/api/v1/upload" \
        --max-time $TIMEOUT 2>/dev/null)
    
    rm -f $test_file
    
    # Wait for processing
    sleep 3
    
    # Ask question about uploaded document
    local chat_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"question": "What is the remote work policy?"}' \
        "$API_URL/api/v1/chat" \
        --max-time $TIMEOUT 2>/dev/null)
    
    # Check if response mentions remote work
    echo "$upload_response" | grep -q "success\|id" && \
    echo "$chat_response" | grep -qi "remote\|work\|policy" && return 0 || return 1
}

run_test "Full RAG workflow" "test_full_workflow"

echo ""
echo -e "${GREEN}=== Test Results Summary ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

for result in "${TEST_RESULTS[@]}"; do
    if [[ $result == PASS:* ]]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "${GREEN}✓ ${result#PASS: }${NC}"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "${RED}✗ ${result#FAIL: }${NC}"
    fi
done

TOTAL_TESTS=${#TEST_RESULTS[@]}
PASS_RATE=$((PASS_COUNT * 100 / TOTAL_TESTS))

echo ""
echo "Results: $PASS_COUNT/$TOTAL_TESTS tests passed ($PASS_RATE%)"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Deployment is healthy.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL_COUNT test(s) failed. Check deployment.${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check service logs: docker-compose logs"
    echo "2. Verify configuration: check .env files"
    echo "3. Test connectivity: ping services individually"
    echo "4. Check resource usage: docker stats"
    exit 1
fi
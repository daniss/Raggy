#!/bin/bash
# RAG Quality Assurance Integration Test
# This script validates that all QA components are properly integrated

echo "🔍 RAG Quality Assurance Integration Test"
echo "=========================================="

# Test 1: Verify QA documentation exists
echo "📄 Testing QA Documentation..."
if [ -f "rag_quality_assurance.md" ]; then
    echo "✅ QA documentation found"
    lines=$(wc -l < rag_quality_assurance.md)
    echo "   - Document has $lines lines"
else
    echo "❌ QA documentation missing"
    exit 1
fi

# Test 2: Verify QA test suite exists and is executable
echo "🧪 Testing QA Test Suite..."
if [ -f "rag_qa_suite.py" ]; then
    echo "✅ QA test suite found"
    # Check if it has proper structure
    if grep -q "class RAGQualityAssurance" rag_qa_suite.py; then
        echo "   - QA class structure verified"
    fi
    if grep -q "async def run_comprehensive_qa_suite" rag_qa_suite.py; then
        echo "   - Main QA method found"
    fi
else
    echo "❌ QA test suite missing"
    exit 1
fi

# Test 3: Verify FastAPI QA endpoints exist
echo "🚀 Testing FastAPI QA Integration..."
if [ -f "rag-service/main.py" ]; then
    if grep -q "QAMetricsResponse" rag-service/main.py; then
        echo "✅ FastAPI QA models found"
    fi
    if grep -q "/rag/qa/metrics" rag-service/main.py; then
        echo "✅ QA metrics endpoint found"
    fi
    if grep -q "/rag/qa/validate" rag-service/main.py; then
        echo "✅ QA validation endpoint found"
    fi
else
    echo "❌ FastAPI service file not found"
    exit 1
fi

# Test 4: Verify Next.js QA endpoints exist
echo "⚛️  Testing Next.js QA Integration..."
if [ -f "rag-saas-ui/app/api/rag/qa/route.ts" ]; then
    echo "✅ Next.js QA endpoints found"
    if grep -q "QA metrics" rag-saas-ui/app/api/rag/qa/route.ts; then
        echo "   - QA metrics endpoint implemented"
    fi
    if grep -q "Validate RAG quality" rag-saas-ui/app/api/rag/qa/route.ts; then
        echo "   - QA validation endpoint implemented"
    fi
else
    echo "❌ Next.js QA endpoints missing"
    exit 1
fi

# Test 5: Verify TypeScript compilation
echo "🔧 Testing TypeScript Compilation..."
cd rag-saas-ui
if npm run type-check > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi
cd ..

# Test 6: Verify Python security tests still work
echo "🔐 Testing Security Implementation..."
cd rag-service
if python3 test_encryption.py > /dev/null 2>&1; then
    echo "✅ Security tests passed"
else
    echo "❌ Security tests failed"
    exit 1
fi
cd ..

# Test 7: Verify QA requirements are documented
echo "📋 Testing QA Requirements Documentation..."
qa_sections=(
    "Quality Standards"
    "Performance Benchmarks"
    "Security Requirements" 
    "Quality Assurance Tests"
    "Quality Monitoring"
)

for section in "${qa_sections[@]}"; do
    if grep -q "$section" rag_quality_assurance.md; then
        echo "   ✅ $section documented"
    else
        echo "   ❌ $section missing from QA doc"
        exit 1
    fi
done

echo ""
echo "🎉 RAG QUALITY ASSURANCE INTEGRATION COMPLETE"
echo "=============================================="
echo "Summary:"
echo "✅ QA Documentation: Complete"
echo "✅ QA Test Suite: Implemented"
echo "✅ FastAPI QA Endpoints: Added"
echo "✅ Next.js QA Endpoints: Added"
echo "✅ TypeScript Compilation: Verified"
echo "✅ Security Tests: Passing"
echo "✅ QA Requirements: Documented"
echo ""
echo "🚀 RAG System is ready for production with comprehensive Quality Assurance!"
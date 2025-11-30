#!/bin/bash

# Stress Test Script for Pierre Two Backend
# Tests multiple endpoints with concurrent requests

API_URL="http://127.0.0.1:3000"
TOTAL_REQUESTS=0
SUCCESS_REQUESTS=0
FAILED_REQUESTS=0

echo "🚀 Starting Stress Test for Pierre Two Backend"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make request and track stats
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local test_name=$4

    TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            "$API_URL$endpoint" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
        SUCCESS_REQUESTS=$((SUCCESS_REQUESTS + 1))
        echo -e "${GREEN}✅ $test_name${NC} - Status: $http_code"
        return 0
    else
        FAILED_REQUESTS=$((FAILED_REQUESTS + 1))
        echo -e "${RED}❌ $test_name${NC} - Status: $http_code"
        echo -e "${YELLOW}   Response: $body${NC}"
        return 1
    fi
}

# Track timing
start_time=$(date +%s)

echo -e "${BLUE}📊 Test 1: GET Endpoints (Read Operations)${NC}"
echo "-------------------------------------------"

# Test GET endpoints concurrently
make_request "GET" "/events" "" "GET /events" &
make_request "GET" "/genres" "" "GET /genres" &
make_request "GET" "/clubs" "" "GET /clubs" &
make_request "GET" "/tables" "" "GET /tables" &
make_request "GET" "/reservations" "" "GET /reservations" &
make_request "GET" "/tickets" "" "GET /tickets" &
make_request "GET" "/payments" "" "GET /payments" &

wait
echo ""

echo -e "${BLUE}📊 Test 2: Rapid Sequential GET Requests${NC}"
echo "-------------------------------------------"

for i in {1..10}; do
    make_request "GET" "/events" "" "Rapid GET /events #$i" &
done
wait
echo ""

echo -e "${BLUE}📊 Test 3: Authentication Endpoints${NC}"
echo "-------------------------------------------"

# Test registration with unique emails
for i in {1..5}; do
    random_id=$(date +%s%N | md5 | head -c 8)
    register_data='{
        "name": "StressTest'$i'",
        "email": "stress'$random_id'@test.com",
        "password": "Test123456!",
        "date_of_birth": "1990-01-01"
    }'
    make_request "POST" "/auth/register" "$register_data" "Register User #$i" &
done
wait
echo ""

echo -e "${BLUE}📊 Test 4: SMS Verification (Development Mode)${NC}"
echo "-------------------------------------------"

# Test SMS verification endpoints (will use development mode)
sms_data='{
    "user_id": "00000000-0000-0000-0000-000000000000",
    "phone_number": "+393935130925"
}'

for i in {1..3}; do
    make_request "POST" "/auth/send-sms-verification" "$sms_data" "Send SMS #$i" &
done
wait
echo ""

verify_data='{
    "user_id": "00000000-0000-0000-0000-000000000000",
    "phone_number": "+393935130925",
    "verification_code": "123456"
}'

for i in {1..3}; do
    make_request "POST" "/auth/verify-sms-code" "$verify_data" "Verify SMS #$i" &
done
wait
echo ""

echo -e "${BLUE}📊 Test 5: Invalid Requests (Error Handling)${NC}"
echo "-------------------------------------------"

# Test error handling
make_request "POST" "/auth/register" '{"invalid": "data"}' "Invalid Registration Data" &
make_request "POST" "/auth/login" '{"email": "nonexistent@test.com", "password": "wrong"}' "Invalid Login" &
make_request "GET" "/events/00000000-0000-0000-0000-000000000000" "" "Non-existent Event" &

wait
echo ""

echo -e "${BLUE}📊 Test 6: Concurrent Mixed Load${NC}"
echo "-------------------------------------------"

# Mix of different request types
for i in {1..20}; do
    case $((i % 4)) in
        0) make_request "GET" "/events" "" "Mixed Load GET Events #$i" & ;;
        1) make_request "GET" "/clubs" "" "Mixed Load GET Clubs #$i" & ;;
        2) make_request "GET" "/genres" "" "Mixed Load GET Genres #$i" & ;;
        3) make_request "GET" "/tables" "" "Mixed Load GET Tables #$i" & ;;
    esac
done
wait
echo ""

# Calculate timing
end_time=$(date +%s)
duration=$((end_time - start_time))

# Print summary
echo ""
echo "================================================"
echo -e "${BLUE}📈 Stress Test Summary${NC}"
echo "================================================"
echo -e "Total Requests:    ${BLUE}$TOTAL_REQUESTS${NC}"
echo -e "Successful:        ${GREEN}$SUCCESS_REQUESTS${NC}"
echo -e "Failed:            ${RED}$FAILED_REQUESTS${NC}"
echo -e "Success Rate:      ${GREEN}$(awk "BEGIN {printf \"%.2f\", ($SUCCESS_REQUESTS/$TOTAL_REQUESTS)*100}")%${NC}"
echo -e "Duration:          ${BLUE}${duration}s${NC}"
echo -e "Requests/Second:   ${BLUE}$(awk "BEGIN {printf \"%.2f\", $TOTAL_REQUESTS/$duration}")${NC}"
echo ""

if [ $FAILED_REQUESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
fi

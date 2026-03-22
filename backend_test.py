#!/usr/bin/env python3
"""
Backend API Testing for MetaWork Printful EDM Integration
Tests all 4 APIs as specified in the review request
"""

import requests
import json
import uuid
import time
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://creator-product-hub.preview.emergentagent.com"

class PrintfulEDMTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str, response_data: Optional[Dict] = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def test_printful_catalog_api(self):
        """Test GET /api/printful/catalog with various parameters"""
        print("\n=== Testing Printful Catalog API ===")
        
        # Test 1: Basic catalog fetch (curated products)
        try:
            response = self.session.get(f"{self.base_url}/api/printful/catalog")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['success', 'products', 'categories', 'totalCount']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Catalog API - Basic Fetch", 
                        False, 
                        f"Missing required fields: {missing_fields}",
                        data
                    )
                else:
                    # Verify product structure
                    if data['products'] and len(data['products']) > 0:
                        product = data['products'][0]
                        product_fields = ['catalogProductId', 'name', 'thumbnailUrl', 'mainCategory', 'type', 'variantCount']
                        missing_product_fields = [field for field in product_fields if field not in product]
                        
                        if missing_product_fields:
                            self.log_test(
                                "Catalog API - Basic Fetch", 
                                False, 
                                f"Product missing fields: {missing_product_fields}",
                                product
                            )
                        else:
                            self.log_test(
                                "Catalog API - Basic Fetch", 
                                True, 
                                f"Retrieved {len(data['products'])} curated products with {len(data['categories'])} categories"
                            )
                    else:
                        self.log_test(
                            "Catalog API - Basic Fetch", 
                            False, 
                            "No products returned",
                            data
                        )
            else:
                self.log_test(
                    "Catalog API - Basic Fetch", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Catalog API - Basic Fetch", False, f"Exception: {str(e)}")
        
        # Test 2: Fetch all products with ?all=true
        try:
            response = self.session.get(f"{self.base_url}/api/printful/catalog?all=true")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'totalCount' in data:
                    self.log_test(
                        "Catalog API - All Products", 
                        True, 
                        f"Retrieved {data['totalCount']} total products"
                    )
                else:
                    self.log_test(
                        "Catalog API - All Products", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Catalog API - All Products", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Catalog API - All Products", False, f"Exception: {str(e)}")
        
        # Test 3: Category filtering with ?category=T-Shirt
        try:
            response = self.session.get(f"{self.base_url}/api/printful/catalog?category=T-Shirt")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test(
                        "Catalog API - Category Filter", 
                        True, 
                        f"Category filter returned {data.get('totalCount', 0)} products"
                    )
                else:
                    self.log_test(
                        "Catalog API - Category Filter", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Catalog API - Category Filter", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Catalog API - Category Filter", False, f"Exception: {str(e)}")
        
        # Test 4: Search with ?search=hoodie
        try:
            response = self.session.get(f"{self.base_url}/api/printful/catalog?search=hoodie")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test(
                        "Catalog API - Search", 
                        True, 
                        f"Search returned {data.get('totalCount', 0)} products"
                    )
                else:
                    self.log_test(
                        "Catalog API - Search", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Catalog API - Search", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Catalog API - Search", False, f"Exception: {str(e)}")
    
    def test_printful_edm_nonce_api(self):
        """Test POST /api/printful/edm-nonce"""
        print("\n=== Testing Printful EDM Nonce API ===")
        
        # Test 1: Anonymous request
        try:
            test_external_product_id = f"test-uuid-{uuid.uuid4()}"
            payload = {
                "externalProductId": test_external_product_id
            }
            
            response = self.session.post(
                f"{self.base_url}/api/printful/edm-nonce",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['success', 'nonce', 'externalProductId', 'isAuthenticated']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "EDM Nonce API - Anonymous", 
                        False, 
                        f"Missing required fields: {missing_fields}",
                        data
                    )
                elif data.get('isAuthenticated') != False:
                    self.log_test(
                        "EDM Nonce API - Anonymous", 
                        False, 
                        f"Expected isAuthenticated=false for anonymous request, got {data.get('isAuthenticated')}",
                        data
                    )
                elif data.get('externalProductId') != test_external_product_id:
                    self.log_test(
                        "EDM Nonce API - Anonymous", 
                        False, 
                        f"External product ID mismatch",
                        data
                    )
                else:
                    nonce_preview = str(data.get('nonce', ''))[:20] if data.get('nonce') else 'None'
                    self.log_test(
                        "EDM Nonce API - Anonymous", 
                        True, 
                        f"Generated nonce for anonymous user: {nonce_preview}..."
                    )
            else:
                self.log_test(
                    "EDM Nonce API - Anonymous", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("EDM Nonce API - Anonymous", False, f"Exception: {str(e)}")
        
        # Test 2: Request with externalCustomerId
        try:
            test_external_product_id = f"test-uuid-{uuid.uuid4()}"
            test_customer_id = f"customer-{uuid.uuid4()}"
            payload = {
                "externalProductId": test_external_product_id,
                "externalCustomerId": test_customer_id
            }
            
            response = self.session.post(
                f"{self.base_url}/api/printful/edm-nonce",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'nonce' in data:
                    nonce_preview = str(data.get('nonce', ''))[:20] if data.get('nonce') else 'None'
                    self.log_test(
                        "EDM Nonce API - With Customer ID", 
                        True, 
                        f"Generated nonce with customer ID: {nonce_preview}..."
                    )
                else:
                    self.log_test(
                        "EDM Nonce API - With Customer ID", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "EDM Nonce API - With Customer ID", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("EDM Nonce API - With Customer ID", False, f"Exception: {str(e)}")
        
        # Test 3: Missing externalProductId
        try:
            payload = {}
            
            response = self.session.post(
                f"{self.base_url}/api/printful/edm-nonce",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'externalProductId' in data['error']:
                    self.log_test(
                        "EDM Nonce API - Missing Product ID", 
                        True, 
                        "Correctly rejected request with missing externalProductId"
                    )
                else:
                    self.log_test(
                        "EDM Nonce API - Missing Product ID", 
                        False, 
                        "Error message doesn't mention externalProductId",
                        data
                    )
            else:
                self.log_test(
                    "EDM Nonce API - Missing Product ID", 
                    False, 
                    f"Expected HTTP 400, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("EDM Nonce API - Missing Product ID", False, f"Exception: {str(e)}")
    
    def test_collections_api(self):
        """Test GET /api/collections (should require auth)"""
        print("\n=== Testing Collections API ===")
        
        # Test 1: Unauthenticated request
        try:
            response = self.session.get(f"{self.base_url}/api/collections")
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data and 'Authentication' in data['error']:
                    self.log_test(
                        "Collections API - No Auth", 
                        True, 
                        "Correctly rejected unauthenticated request"
                    )
                else:
                    self.log_test(
                        "Collections API - No Auth", 
                        False, 
                        "Error message doesn't mention authentication",
                        data
                    )
            else:
                self.log_test(
                    "Collections API - No Auth", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Collections API - No Auth", False, f"Exception: {str(e)}")
        
        # Test 2: Invalid token
        try:
            headers = {"Authorization": "Bearer invalid-token-123"}
            response = self.session.get(f"{self.base_url}/api/collections", headers=headers)
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_test(
                        "Collections API - Invalid Token", 
                        True, 
                        "Correctly rejected invalid token"
                    )
                else:
                    self.log_test(
                        "Collections API - Invalid Token", 
                        False, 
                        "No error message for invalid token",
                        data
                    )
            else:
                self.log_test(
                    "Collections API - Invalid Token", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Collections API - Invalid Token", False, f"Exception: {str(e)}")
    
    def test_create_from_edm_api(self):
        """Test POST /api/metawork/products/create-from-edm (should require auth)"""
        print("\n=== Testing Create-from-EDM API ===")
        
        # Test 1: Unauthenticated request
        try:
            payload = {
                "externalProductId": f"test-{uuid.uuid4()}",
                "title": "Test Product",
                "price": 29.99
            }
            
            response = self.session.post(
                f"{self.base_url}/api/metawork/products/create-from-edm",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data and ('Authentication' in data['error'] or 'AUTH_REQUIRED' in data.get('code', '')):
                    self.log_test(
                        "Create-from-EDM API - No Auth", 
                        True, 
                        "Correctly rejected unauthenticated request"
                    )
                else:
                    self.log_test(
                        "Create-from-EDM API - No Auth", 
                        False, 
                        "Error message doesn't mention authentication",
                        data
                    )
            else:
                self.log_test(
                    "Create-from-EDM API - No Auth", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Create-from-EDM API - No Auth", False, f"Exception: {str(e)}")
        
        # Test 2: Invalid token
        try:
            payload = {
                "externalProductId": f"test-{uuid.uuid4()}",
                "title": "Test Product",
                "price": 29.99
            }
            headers = {"Authorization": "Bearer invalid-token-123", "Content-Type": "application/json"}
            
            response = self.session.post(
                f"{self.base_url}/api/metawork/products/create-from-edm",
                json=payload,
                headers=headers
            )
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data and ('Invalid' in data['error'] or 'INVALID_TOKEN' in data.get('code', '')):
                    self.log_test(
                        "Create-from-EDM API - Invalid Token", 
                        True, 
                        "Correctly rejected invalid token"
                    )
                else:
                    self.log_test(
                        "Create-from-EDM API - Invalid Token", 
                        False, 
                        "Error message doesn't mention invalid token",
                        data
                    )
            else:
                self.log_test(
                    "Create-from-EDM API - Invalid Token", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Create-from-EDM API - Invalid Token", False, f"Exception: {str(e)}")
        
        # Test 3: Missing required fields
        try:
            payload = {
                "externalProductId": f"test-{uuid.uuid4()}"
                # Missing title and price
            }
            headers = {"Authorization": "Bearer invalid-token-123", "Content-Type": "application/json"}
            
            response = self.session.post(
                f"{self.base_url}/api/metawork/products/create-from-edm",
                json=payload,
                headers=headers
            )
            
            # Should get 401 for invalid token before field validation
            if response.status_code == 401:
                self.log_test(
                    "Create-from-EDM API - Missing Fields", 
                    True, 
                    "Authentication check happens before field validation (expected)"
                )
            else:
                self.log_test(
                    "Create-from-EDM API - Missing Fields", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Create-from-EDM API - Missing Fields", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Printful EDM Integration API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Run all test suites
        self.test_printful_catalog_api()
        self.test_printful_edm_nonce_api()
        self.test_collections_api()
        self.test_create_from_edm_api()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = PrintfulEDMTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)
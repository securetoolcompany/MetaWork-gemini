#!/usr/bin/env python3
"""
Backend API Testing for Category & Tags Filtering Feature
Tests the newly implemented filtering functionality for Products and Showroom APIs
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://creator-product-hub.preview.emergentagent.com"

class CategoryTagsFilterTester:
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
    
    def test_products_list_api(self):
        """Test GET /api/metawork/products with Category & Tags filtering"""
        print("\n=== Testing Products List API with Category & Tags Filtering ===")
        
        # Test 1: Basic public request
        try:
            response = self.session.get(f"{self.base_url}/api/metawork/products?public=true")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['success', 'products', 'pagination', 'filters']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Products API - Basic Public Request", 
                        False, 
                        f"Missing required fields: {missing_fields}",
                        data
                    )
                else:
                    # Verify filters structure
                    filters = data.get('filters', {})
                    if 'categories' not in filters or 'popularTags' not in filters:
                        self.log_test(
                            "Products API - Basic Public Request", 
                            False, 
                            "Missing categories or popularTags in filters",
                            filters
                        )
                    else:
                        self.log_test(
                            "Products API - Basic Public Request", 
                            True, 
                            f"Retrieved {len(data['products'])} products with {len(filters['categories'])} categories and {len(filters['popularTags'])} popular tags"
                        )
            else:
                self.log_test(
                    "Products API - Basic Public Request", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Products API - Basic Public Request", False, f"Exception: {str(e)}")
        
        # Test 2: Filter by systemCategory
        try:
            response = self.session.get(f"{self.base_url}/api/metawork/products?public=true&systemCategory=apparel")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    # Check if products have systemCategory or categories field with 'apparel'
                    category_match = True
                    for product in products[:5]:  # Check first 5 products
                        has_category = (
                            product.get('systemCategory') == 'apparel' or
                            'apparel' in (product.get('categories', []))
                        )
                        if not has_category:
                            category_match = False
                            break
                    
                    if category_match or len(products) == 0:
                        self.log_test(
                            "Products API - systemCategory Filter", 
                            True, 
                            f"Category filter returned {len(products)} products"
                        )
                    else:
                        self.log_test(
                            "Products API - systemCategory Filter", 
                            False, 
                            "Some products don't match the category filter",
                            products[0] if products else None
                        )
                else:
                    self.log_test(
                        "Products API - systemCategory Filter", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Products API - systemCategory Filter", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Products API - systemCategory Filter", False, f"Exception: {str(e)}")
        
        # Test 3: Filter by userTags
        try:
            response = self.session.get(f"{self.base_url}/api/metawork/products?public=true&userTags=vintage,retro")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    self.log_test(
                        "Products API - userTags Filter", 
                        True, 
                        f"Tags filter returned {len(products)} products"
                    )
                else:
                    self.log_test(
                        "Products API - userTags Filter", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Products API - userTags Filter", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Products API - userTags Filter", False, f"Exception: {str(e)}")
        
        # Test 4: Search functionality
        try:
            response = self.session.get(f"{self.base_url}/api/metawork/products?public=true&search=shirt")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    self.log_test(
                        "Products API - Search", 
                        True, 
                        f"Search returned {len(products)} products"
                    )
                else:
                    self.log_test(
                        "Products API - Search", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Products API - Search", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Products API - Search", False, f"Exception: {str(e)}")
        
        # Test 5: Pagination
        try:
            response = self.session.get(f"{self.base_url}/api/metawork/products?public=true&page=1&limit=10")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    pagination = data.get('pagination', {})
                    
                    # Verify pagination structure
                    pagination_fields = ['page', 'limit', 'totalCount', 'totalPages']
                    missing_pagination = [field for field in pagination_fields if field not in pagination]
                    
                    if missing_pagination:
                        self.log_test(
                            "Products API - Pagination", 
                            False, 
                            f"Missing pagination fields: {missing_pagination}",
                            pagination
                        )
                    elif len(products) <= 10:
                        self.log_test(
                            "Products API - Pagination", 
                            True, 
                            f"Pagination returned {len(products)} products (limit=10)"
                        )
                    else:
                        self.log_test(
                            "Products API - Pagination", 
                            False, 
                            f"Returned {len(products)} products, expected max 10",
                            pagination
                        )
                else:
                    self.log_test(
                        "Products API - Pagination", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Products API - Pagination", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Products API - Pagination", False, f"Exception: {str(e)}")
        
        # Test 6: Combined filters
        try:
            response = self.session.get(f"{self.base_url}/api/metawork/products?public=true&systemCategory=apparel&userTags=vintage")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    self.log_test(
                        "Products API - Combined Filters", 
                        True, 
                        f"Combined filters returned {len(products)} products"
                    )
                else:
                    self.log_test(
                        "Products API - Combined Filters", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Products API - Combined Filters", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Products API - Combined Filters", False, f"Exception: {str(e)}")
    
    def test_showroom_api(self):
        """Test GET /api/showroom with Category & Tags filtering"""
        print("\n=== Testing Showroom API with Category & Tags Filtering ===")
        
        # Test 1: Basic showroom request
        try:
            response = self.session.get(f"{self.base_url}/api/showroom")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['success', 'creators', 'products', 'filters']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Showroom API - Basic Request", 
                        False, 
                        f"Missing required fields: {missing_fields}",
                        data
                    )
                else:
                    # Verify filters structure
                    filters = data.get('filters', {})
                    if 'categories' not in filters or 'popularTags' not in filters:
                        self.log_test(
                            "Showroom API - Basic Request", 
                            False, 
                            "Missing categories or popularTags in filters",
                            filters
                        )
                    else:
                        self.log_test(
                            "Showroom API - Basic Request", 
                            True, 
                            f"Retrieved {len(data['creators'])} creators and {len(data['products'])} products with filters"
                        )
            else:
                self.log_test(
                    "Showroom API - Basic Request", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Showroom API - Basic Request", False, f"Exception: {str(e)}")
        
        # Test 2: Filter by systemCategory
        try:
            response = self.session.get(f"{self.base_url}/api/showroom?systemCategory=apparel")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    self.log_test(
                        "Showroom API - systemCategory Filter", 
                        True, 
                        f"Category filter returned {len(products)} products"
                    )
                else:
                    self.log_test(
                        "Showroom API - systemCategory Filter", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Showroom API - systemCategory Filter", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Showroom API - systemCategory Filter", False, f"Exception: {str(e)}")
        
        # Test 3: Filter by userTags
        try:
            response = self.session.get(f"{self.base_url}/api/showroom?userTags=vintage")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    self.log_test(
                        "Showroom API - userTags Filter", 
                        True, 
                        f"Tags filter returned {len(products)} products"
                    )
                else:
                    self.log_test(
                        "Showroom API - userTags Filter", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Showroom API - userTags Filter", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Showroom API - userTags Filter", False, f"Exception: {str(e)}")
        
        # Test 4: Search + category combination
        try:
            response = self.session.get(f"{self.base_url}/api/showroom?search=shirt&systemCategory=apparel")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    products = data.get('products', [])
                    self.log_test(
                        "Showroom API - Search + Category", 
                        True, 
                        f"Search + category filter returned {len(products)} products"
                    )
                else:
                    self.log_test(
                        "Showroom API - Search + Category", 
                        False, 
                        "Invalid response structure",
                        data
                    )
            else:
                self.log_test(
                    "Showroom API - Search + Category", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Showroom API - Search + Category", False, f"Exception: {str(e)}")
    
    def test_product_update_api(self):
        """Test PUT /api/metawork/products/[id] with systemCategory and userTags (requires auth)"""
        print("\n=== Testing Product Update API with systemCategory/userTags ===")
        
        # Test 1: Unauthenticated request
        try:
            test_product_id = "test-product-123"
            payload = {
                "systemCategory": "apparel",
                "userTags": ["vintage", "retro"]
            }
            
            response = self.session.put(
                f"{self.base_url}/api/metawork/products/{test_product_id}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data and 'Authentication' in data['error']:
                    self.log_test(
                        "Product Update API - No Auth", 
                        True, 
                        "Correctly rejected unauthenticated request"
                    )
                else:
                    self.log_test(
                        "Product Update API - No Auth", 
                        False, 
                        "Error message doesn't mention authentication",
                        data
                    )
            else:
                self.log_test(
                    "Product Update API - No Auth", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Product Update API - No Auth", False, f"Exception: {str(e)}")
        
        # Test 2: Invalid token
        try:
            test_product_id = "test-product-123"
            payload = {
                "systemCategory": "apparel",
                "userTags": ["vintage", "retro"]
            }
            headers = {"Authorization": "Bearer invalid-token-123", "Content-Type": "application/json"}
            
            response = self.session.put(
                f"{self.base_url}/api/metawork/products/{test_product_id}",
                json=payload,
                headers=headers
            )
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data and 'Invalid' in data['error']:
                    self.log_test(
                        "Product Update API - Invalid Token", 
                        True, 
                        "Correctly rejected invalid token"
                    )
                else:
                    self.log_test(
                        "Product Update API - Invalid Token", 
                        False, 
                        "Error message doesn't mention invalid token",
                        data
                    )
            else:
                self.log_test(
                    "Product Update API - Invalid Token", 
                    False, 
                    f"Expected HTTP 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test("Product Update API - Invalid Token", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Category & Tags Filtering API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Run all test suites
        self.test_products_list_api()
        self.test_showroom_api()
        self.test_product_update_api()
        
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
    tester = CategoryTagsFilterTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)
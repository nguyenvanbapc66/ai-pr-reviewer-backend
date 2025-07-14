#!/usr/bin/env node

/**
 * Memory test script for the AI PR Reviewer backend
 * This script helps verify that memory optimizations are working correctly
 */

const http = require('http');

const testDiff = `
+ function testFunction() {
+   console.log("This is a test function");
+   const data = new Array(1000).fill("test data");
+   return data.map(item => item.toUpperCase());
+ }
+ 
+ class TestClass {
+   constructor() {
+     this.data = [];
+   }
+   
+   addItem(item) {
+     this.data.push(item);
+   }
+   
+   getItems() {
+     return this.data;
+   }
+ }
`;

const testRequest = {
  diff: testDiff,
  promptConfig: {
    tone: 'professional',
    focus: 'general',
    detail: 'detailed',
  },
};

function makeRequest() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testRequest);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/review',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runMemoryTest() {
  console.log('Starting memory test...');
  console.log('Make sure the server is running on port 3000');

  try {
    // Make multiple requests to test memory usage
    for (let i = 1; i <= 5; i++) {
      console.log(`\n--- Test ${i}/5 ---`);
      const startTime = Date.now();

      const response = await makeRequest();

      const endTime = Date.now();
      console.log(`Request ${i} completed in ${endTime - startTime}ms`);
      console.log(`Response has ${response.comments?.length || 0} comments`);

      // Wait a bit between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Memory test completed successfully!');
  } catch (error) {
    console.error('❌ Memory test failed:', error.message);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runMemoryTest();
}

module.exports = { makeRequest, runMemoryTest };

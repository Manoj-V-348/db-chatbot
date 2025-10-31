import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from './src/firebase';

interface TestResult {
  collection: string;
  query: string;
  status: 'success' | 'failed';
  error?: string;
  docsCount?: number;
}

const results: TestResult[] = [];

/**
 * Test a Firestore query and record the result
 */
async function testQuery(
  collectionName: string,
  queryDescription: string,
  firestoreQuery: any,
): Promise<void> {
  try {
    const snapshot = await getDocs(firestoreQuery);
    results.push({
      collection: collectionName,
      query: queryDescription,
      status: 'success',
      docsCount: snapshot.size,
    });
    console.log(`✅ ${collectionName}: ${queryDescription} (${snapshot.size} docs)`);
  } catch (error: any) {
    results.push({
      collection: collectionName,
      query: queryDescription,
      status: 'failed',
      error: error.message,
    });
    console.error(`❌ ${collectionName}: ${queryDescription} - ${error.message}`);
  }
}

/**
 * Main test function
 */
async function testAllIndexes() {
  console.log('\n🔥 Starting Firestore Index Validation Tests...\n');
  console.log('═'.repeat(80));

  const collections = ['college1', 'school1', 'school2'];

  for (const collectionName of collections) {
    console.log(`\n📊 Testing collection: ${collectionName}`);
    console.log('─'.repeat(80));

    const col = collection(db, collectionName);

    // Test 1: Single field query
    await testQuery(
      collectionName,
      'Single field: where("status", "==", "active")',
      query(col, where('status', '==', 'active'), limit(10)),
    );

    // Test 2: Status + orderBy income
    await testQuery(
      collectionName,
      'Composite: status + orderBy(income)',
      query(col, where('status', '==', 'active'), orderBy('income', 'desc'), limit(10)),
    );

    // Test 3: Status + orderBy salary
    await testQuery(
      collectionName,
      'Composite: status + orderBy(salary)',
      query(col, where('status', '==', 'active'), orderBy('salary', 'desc'), limit(10)),
    );

    // Test 4: Status + orderBy staff
    await testQuery(
      collectionName,
      'Composite: status + orderBy(staff)',
      query(col, where('status', '==', 'active'), orderBy('staff', 'desc'), limit(10)),
    );

    // Test 5: Status + orderBy rent
    await testQuery(
      collectionName,
      'Composite: status + orderBy(rent)',
      query(col, where('status', '==', 'active'), orderBy('rent', 'desc'), limit(10)),
    );

    // Test 6: Status + orderBy electricity
    await testQuery(
      collectionName,
      'Composite: status + orderBy(electricity)',
      query(col, where('status', '==', 'active'), orderBy('electricity', 'desc'), limit(10)),
    );

    // Test 7: Status + orderBy misc
    await testQuery(
      collectionName,
      'Composite: status + orderBy(misc)',
      query(col, where('status', '==', 'active'), orderBy('misc', 'desc'), limit(10)),
    );

    // Test 8: Status + orderBy name (for search)
    await testQuery(
      collectionName,
      'Composite: status + orderBy(name)',
      query(col, where('status', '==', 'active'), orderBy('name', 'asc'), limit(10)),
    );

    // Test 9: Type + orderBy income
    await testQuery(
      collectionName,
      'Composite: type + orderBy(income)',
      query(col, where('type', '==', 'school'), orderBy('income', 'desc'), limit(10)),
    );

    // Test 10: Type + orderBy salary
    await testQuery(
      collectionName,
      'Composite: type + orderBy(salary)',
      query(col, where('type', '==', 'school'), orderBy('salary', 'desc'), limit(10)),
    );

    // Test 11: Type + orderBy staff
    await testQuery(
      collectionName,
      'Composite: type + orderBy(staff)',
      query(col, where('type', '==', 'school'), orderBy('staff', 'desc'), limit(10)),
    );

    // Test 12: Status + Type + orderBy income (triple composite)
    await testQuery(
      collectionName,
      'Composite: status + type + orderBy(income)',
      query(
        col,
        where('status', '==', 'active'),
        where('type', '==', 'school'),
        orderBy('income', 'desc'),
        limit(10),
      ),
    );
  }

  // Print summary
  console.log('\n═'.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log('');

  // Print table
  console.log('┌─────────────┬──────────────────────────────────────────────┬─────────┬───────┐');
  console.log('│ Collection  │ Query                                        │ Status  │ Docs  │');
  console.log('├─────────────┼──────────────────────────────────────────────┼─────────┼───────┤');

  results.forEach((result) => {
    const collectionPadded = result.collection.padEnd(11);
    const queryPadded = result.query.substring(0, 44).padEnd(44);
    const statusIcon = result.status === 'success' ? '✅ Pass' : '❌ Fail';
    const docsCount = result.docsCount !== undefined ? String(result.docsCount).padStart(5) : '  -  ';

    console.log(`│ ${collectionPadded} │ ${queryPadded} │ ${statusIcon}  │ ${docsCount} │`);
  });

  console.log('└─────────────┴──────────────────────────────────────────────┴─────────┴───────┘');

  // Print failed queries details
  if (failedCount > 0) {
    console.log('\n❌ FAILED QUERIES DETAILS:\n');
    results
      .filter((r) => r.status === 'failed')
      .forEach((result) => {
        console.log(`Collection: ${result.collection}`);
        console.log(`Query: ${result.query}`);
        console.log(`Error: ${result.error}`);
        console.log('');
      });
  }

  console.log('═'.repeat(80));

  if (failedCount === 0) {
    console.log('\n🎉 All index tests passed! Your Firestore indexes are properly configured.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please deploy the indexes using:');
    console.log('   firebase deploy --only firestore:indexes\n');
  }
}

// Run tests
testAllIndexes()
  .then(() => {
    console.log('✅ Test execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error during testing:', error);
    process.exit(1);
  });

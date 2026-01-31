
const { fetchAircraftDetails } = require('./lib/services/firecrawlService');
require('dotenv').config({ path: '.env.local' }); // Try local first
require('dotenv').config({ path: '.env' }); // Fallback

async function testFetch() {
    console.log('Testing fetch for N734DA...');
    try {
        const result = await fetchAircraftDetails('N734DA');
        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.data?.operatingLimits) {
            console.log('✅ Operating Limits found!');
        } else {
            console.log('❌ No Operating Limits found.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testFetch();

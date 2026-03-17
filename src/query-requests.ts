import * as api from './lib/api.js';

async function main() {
  // Example OData query string to filter requests with status "completed", order by assignee, and include count of total matching requests.
  const queryString = "$filter=status eq 'completed'&$orderby=assignee&$count=true";
  try {
    const result = await api.queryRequests(queryString);
    console.log('Query result length:', result['@odata.count']);
    for (const request of result.value) {
      console.log(
        `Request ID: ${request.id}, Status: ${request.status}, Assignee: ${JSON.stringify(request.assignee)}`,
      );
    }
  } catch (error) {
    console.error('Error querying requests:', error);
  }
}

await main();

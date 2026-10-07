const http = require('http');

const routes = ['/', '/stocks', '/shelves', '/equipment', '/movements'];

async function fetchRoute(route) {
  const start = Date.now();
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${route}`, (res) => {
      // Consume the stream to end the request
      res.on('data', () => {});
      res.on('end', () => {
        resolve(Date.now() - start);
      });
    }).on('error', (err) => {
      console.error(`Error on ${route}:`, err.message);
      resolve(null);
    });
  });
}

async function run() {
  console.log('Waiting for Next.js to be ready...');
  await new Promise(r => setTimeout(r, 5000));
  
  const results = {};
  
  for (const route of routes) {
    console.log(`Benchmarking cold ${route}...`);
    const cold = await fetchRoute(route);
    results[route] = { cold };
  }
  
  for (const route of routes) {
    console.log(`Benchmarking warm ${route}...`);
    const warm = await fetchRoute(route);
    results[route].warm = warm;
  }
  
  console.table(results);
}

run();

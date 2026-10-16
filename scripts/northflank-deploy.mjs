// Creates a Northflank deployment service that runs a public container image.
// Uses the documented endpoint: POST https://api.northflank.com/v1/projects/{projectId}/services/deployment
// (payload shape follows the "run a container with an image" examples in Northflank's docs).
//
// Usage:
//   NORTHFLANK_API_TOKEN=... NF_PROJECT_ID=... NF_IMAGE=ghcr.io/<owner>/skystunt:latest \
//     node scripts/northflank-deploy.mjs            # dry run: prints the payload only
//     node scripts/northflank-deploy.mjs --apply    # sends the request
//
// Optional: NF_PLAN (default nf-compute-20), NF_SERVICE_NAME (default skystunt).
// The token is read from the environment only. It is never written to a file.
const apply = process.argv.includes('--apply');
const token = process.env.NORTHFLANK_API_TOKEN;
const projectId = process.env.NF_PROJECT_ID;
const image = process.env.NF_IMAGE;
const plan = process.env.NF_PLAN || 'nf-compute-20';
const name = process.env.NF_SERVICE_NAME || 'skystunt';

if (!projectId || !image) {
  console.error('Set NF_PROJECT_ID and NF_IMAGE (for example ghcr.io/<owner>/skystunt:latest).');
  process.exit(2);
}

const payload = {
  name,
  billing: { deploymentPlan: plan },
  deployment: { instances: 1, external: { imagePath: image } },
  ports: [{ name: 'http', internalPort: 8080, public: true, protocol: 'HTTP' }],
  runtimeEnvironment: { NODE_ENV: 'production', PORT: '8080', HOST: '0.0.0.0', MAX_ROOMS: '40', MAX_CONNECTIONS: '200' },
};

const url = `https://api.northflank.com/v1/projects/${projectId}/services/deployment`;
if (!apply) {
  console.log('DRY RUN. Would POST to', url);
  console.log(JSON.stringify(payload, null, 2));
  console.log('\nRe-run with --apply and NORTHFLANK_API_TOKEN set to create the service.');
  process.exit(0);
}
if (!token) { console.error('NORTHFLANK_API_TOKEN is not set.'); process.exit(2); }

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log('HTTP', res.status);
console.log(text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);

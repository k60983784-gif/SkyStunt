// Creates a Northflank service for SkyStunt.io from one of two sources:
//   NF_REPO_URL  (preferred): a combined service that builds the repo's Dockerfile on Northflank.
//                Payload shape follows Northflank's GitOps "CombinedService" template.
//                A PUBLIC GitHub repo needs no linked Git account (Northflank API docs).
//   NF_IMAGE:    a deployment service from an existing public container image.
//
// Usage (dry run prints the payload; --apply sends it):
//   NORTHFLANK_API_TOKEN=... NF_PROJECT_ID=default NF_REPO_URL=https://github.com/<owner>/skystunt \
//     node scripts/northflank-deploy.mjs [--apply]
//
// Optional: NF_PLAN (default nf-compute-20), NF_BUILD_PLAN (default nf-compute-200-8),
//           NF_BRANCH (default main), NF_SERVICE_NAME (default skystunt).
// The token is read from the environment only and never written to a file.
const apply = process.argv.includes('--apply');
const token = process.env.NORTHFLANK_API_TOKEN;
const projectId = process.env.NF_PROJECT_ID || 'default';
const repoUrl = process.env.NF_REPO_URL;
const image = process.env.NF_IMAGE;
const plan = process.env.NF_PLAN || 'nf-compute-20';
const buildPlan = process.env.NF_BUILD_PLAN || 'nf-compute-200-8';
const branch = process.env.NF_BRANCH || 'main';
const name = process.env.NF_SERVICE_NAME || 'skystunt';

const runtimeEnvironment = { NODE_ENV: 'production', PORT: '8080', HOST: '0.0.0.0', MAX_ROOMS: '40', MAX_CONNECTIONS: '200' };
const ports = [{ name: 'http', internalPort: 8080, public: true, protocol: 'HTTP' }];

let url, payload;
if (repoUrl) {
  url = `https://api.northflank.com/v1/projects/${projectId}/services/combined`;
  payload = {
    name,
    billing: { deploymentPlan: plan, buildPlan },
    deployment: { instances: 1, docker: { configType: 'default' } },
    runtimeEnvironment,
    vcsData: { projectType: 'github', projectUrl: repoUrl, projectBranch: branch },
    buildSettings: { dockerfile: { buildEngine: 'kaniko', dockerFilePath: '/Dockerfile', dockerWorkDir: '/' } },
    ports,
  };
} else if (image) {
  url = `https://api.northflank.com/v1/projects/${projectId}/services/deployment`;
  payload = { name, billing: { deploymentPlan: plan }, deployment: { instances: 1, external: { imagePath: image } }, ports, runtimeEnvironment };
} else {
  console.error('Set NF_REPO_URL (preferred) or NF_IMAGE.');
  process.exit(2);
}

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
console.log(text.slice(0, 3000));
process.exit(res.ok ? 0 : 1);

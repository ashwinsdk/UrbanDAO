// SPDX-License-Identifier: MIT
// Export selected contract ABIs to the frontend Angular app

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../../urbandao/src/app/core/abis');
const ART_ROOT = path.join(__dirname, '../artifacts/contracts');

const CONTRACTS = [
  'UrbanCore.sol/UrbanCore.json',
  'UrbanToken.sol/UrbanToken.json',
  'GrievanceHub.sol/GrievanceHub.json',
  'ProjectRegistry.sol/ProjectRegistry.json',
  'TaxModule.sol/TaxModule.json',
  'MetaForwarder.sol/MetaForwarder.json',
  'UrbanGovernor.sol/UrbanGovernor.json',
  'TaxReceipt.sol/TaxReceipt.json',
];

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const rel of CONTRACTS) {
    const src = path.join(ART_ROOT, rel);
    const dst = path.join(OUT_DIR, path.basename(rel));
    if (!fs.existsSync(src)) {
      console.warn('Missing artifact, did you build?', src);
      continue;
    }
    const json = JSON.parse(fs.readFileSync(src, 'utf8'));
    // Write ABI-only JSON to keep bundles smaller
    const payload = JSON.stringify({ abi: json.abi }, null, 2);
    fs.writeFileSync(dst, payload);
    console.log('Wrote ABI:', dst);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

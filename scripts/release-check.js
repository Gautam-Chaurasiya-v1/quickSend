import { readFileSync } from 'node:fs';
const tag=process.env.RELEASE_TAG;
const version=JSON.parse(readFileSync('package.json')).version;
const manifest=JSON.parse(readFileSync('extension/manifest.json'));
if(tag!==`v${version}` || manifest.version!==version)throw Error('Release tag, package version, and extension version must match.');
console.log(`Verified release ${tag}.`);

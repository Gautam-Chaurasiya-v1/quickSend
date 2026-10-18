import { readdirSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function check(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())check(path);else if(/\.m?js$/.test(path)){const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(result.status);}}}}
for(const dir of ['extension','server','scripts','tests'])check(dir);
const manifest=JSON.parse(readFileSync('extension/manifest.json','utf8'));
if(manifest.version!==JSON.parse(readFileSync('package.json','utf8')).version)throw Error('Package and extension versions must match.');
if(manifest.manifest_version!==3 || manifest.host_permissions || manifest.content_scripts)throw Error('Unexpected extension access.');
if(readFileSync('extension/app.html','utf8')!==readFileSync('extension/popup.html','utf8'))throw Error('Popup and full-page shell must match.');
console.log('Syntax, manifest permissions, and UI shells checked.');

import { cpSync,mkdirSync,readdirSync,rmSync,writeFileSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
rmSync('dist/extension',{recursive:true,force:true});mkdirSync('dist',{recursive:true});cpSync('extension','dist/extension',{recursive:true});cpSync('THIRD_PARTY_NOTICES.md','dist/extension/THIRD_PARTY_NOTICES.md');
const files={};function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())walk(file);else files[file.replace('dist/extension/','')]=createHash('sha256').update(readFileSync(file)).digest('hex');}}walk('dist/extension');
writeFileSync('dist/checksums.json',JSON.stringify(files,null,2)+'\n');console.log(`Built ${Object.keys(files).length} extension files in dist/extension. No remote scripts or npm installation step.`);

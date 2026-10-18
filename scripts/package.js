/** Release packaging uses the system ZIP utility (available on macOS and Ubuntu CI). */
import { spawnSync } from 'node:child_process';
import { existsSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const file=resolve('dist/quicksend-extension.zip');
if(!existsSync('dist/extension/manifest.json'))throw new Error('Run npm run build first.');
rmSync(file,{force:true});
const result=spawnSync('zip',['-X','-q','-r',file,'.'],{cwd:'dist/extension',stdio:'inherit'});
if(result.error)throw new Error('Release packaging needs the zip command. Install it or use the GitHub release workflow.');
if(result.status)process.exit(result.status);
writeFileSync('dist/SHA256SUMS',`${createHash('sha256').update(readFileSync(file)).digest('hex')}  quicksend-extension.zip\n`);
console.log('Packaged dist/quicksend-extension.zip and dist/SHA256SUMS.');

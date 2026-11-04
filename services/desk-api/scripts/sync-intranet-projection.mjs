// Regenerate the versioned calculation snapshot from the intranet source checkout.
// Usage: node scripts/sync-intranet-projection.mjs /absolute/path/to/sedu-intranet [--tuition-sales]
import {createRequire} from 'node:module';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=process.argv[2];
if(!source) throw new Error('Provide the intranet source checkout path.');
const root=resolve(source), require=createRequire(join(root,'package.json'));
const {build}=require('esbuild');
const sales=process.argv[3]==='--tuition-sales';
const output=resolve(dirname(fileURLToPath(import.meta.url)),sales?'../src/tuition/lesson-sales-projection.js':'../src/payroll/intranet-projection.js');
const entries=sales ? [
  ['functions/publishedView.js','publishedView'], ['functions/savedBillingLessons.js','savedBillingLessons'],
  ['src/savedFeeView.ts','savedFeeView'], ['src/projectMonthlyLessons.ts','projectMonthlyLessons'],
  ['src/domain.ts','estimatedCharge'], ['functions/carriedFees.js','readCarriedFees']
] : [['src/fees.ts','applyFees'],['src/domain.ts','estimatedCharge'],['functions/feeHistory.js','inheritFees,recoverIssueFees'],['functions/portalChanges.js','changed'],['src/feeReview.ts','projectedFeeRows'],['functions/carriedFees.js','carryMonthlyFees,readCarriedFees'],['functions/studentDiscounts.js','discountPolicyFor'],['functions/singleIndividual.js','validSingleIndividual']];
const contents=entries.map(([file,names])=>`export {${names}} from ${JSON.stringify('./'+file)};`).join('\n');
const result=await build({stdin:{contents,resolveDir:root,sourcefile:'projection-entry.js'},absWorkingDir:root,bundle:true,platform:'node',format:'esm',outfile:output,metafile:true,banner:{js:'// Versioned intranet calculation snapshot. Regenerate with scripts/sync-intranet-projection.mjs; see the adjacent source manifest.'}});
const hashes=Object.fromEntries(Object.keys(result.metafile.inputs).filter(p=>p!=='projection-entry.js').sort().map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
writeFileSync(output.replace('.js','.sources.json'),JSON.stringify({generatedAt:new Date().toISOString(),sourceHashes:hashes},null,2)+'\n');

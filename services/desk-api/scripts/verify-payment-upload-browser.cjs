const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 await page.setContent('<button id="tuitionPaymentLinkBtn">결제링크</button>');
 await page.evaluate(()=>{
 window.state={tuition:{selectedMonth:'26-10s',months:['26-10s']}};
 window.escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 window.tuitionMoneyHtml_=n=>String(n);window.calls=[];
 window.runServer=async(method,p)=>{calls.push({method,p});return method==='getTuitionMonthSummary'?{success:true,rows:[{studentName:'가상학생'}]}:{success:true};};
 window.buildClientRequestId_=()=> 'mock-request';window.refreshTuitionSummary=()=>{};
 });
 await page.addScriptTag({path:process.env.XLSX_TEST_SCRIPT || '/tmp/desk-test-xlsx.min.js'});
 await page.addScriptTag({path:'docs/payment-link-parser.js'});
 await page.addScriptTag({path:'docs/payment-link-upload.js'});
 await page.getByRole('button',{name:'결제링크',exact:true}).click();
 const input=page.getByLabel('결제내역 엑셀 파일');
 if(process.env.PAYMENT_TEST_FILE){
 await input.setInputFiles(process.env.PAYMENT_TEST_FILE);
 await page.getByRole('status').filter({hasText:/건을 읽었습니다/}).waitFor();
 const count=await page.locator('[data-include]').count();assert.equal(count,104);
 await page.getByRole('button',{name:'전체 선택해제',exact:true}).click();
 assert.equal(await page.locator('[data-include]:checked').count(),0);
 assert.equal(await page.getByRole('button',{name:'중복 검사',exact:true}).isEnabled(),false);
 console.log('PASS attached workbook: 102 source rows → 104 payment/refund preview rows; deselect all; no payment calls');
 }
 const bytes=await page.evaluate(()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
 ['결제상태','결제일시','이름','품목(청구사유)','승인번호','청구금액(원)','결제금액(원)'],
 ['결제','2026-10-24','가상학생','10월 수강료','001',900000,300000],
 ['결제','2026-10-23','가상학생','10월 수강료','002',900000,400000]
 ]),'결제내역');return Array.from(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));});
 await input.setInputFiles({name:'mock.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
 await page.getByRole('status').filter({hasText:'2건을 읽었습니다'}).waitFor();
 await page.getByRole('button',{name:'중복 검사',exact:true}).click();
 await page.getByRole('button',{name:'새 수납 입력',exact:true}).waitFor({state:'visible'});
 await page.locator('[data-result-filter]').selectOption('review');
 assert.equal(await page.locator('[data-include]').count(),0);
 await page.getByRole('button',{name:'전체 선택해제',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'새 수납 입력',exact:true}).isEnabled(),false);
 await page.locator('[data-result-filter]').selectOption('all');
 assert.equal(await page.locator('[data-include]:checked').count(),0);
 await page.locator('[data-include="1"]').check();
 await page.getByRole('button',{name:'새 수납 입력',exact:true}).click();
 await page.getByRole('status').filter({hasText:/입력 완료 1건/}).waitFor();
 const writes=await page.evaluate(()=>calls.filter(c=>c.method==='importTuitionPaymentLink'));
 assert.equal(writes.length,1);assert.equal(writes[0].p.approvalNo,'002');
 assert.equal(await page.locator('[data-include="1"]').isEnabled(),false);
 console.log('PASS hidden rows deselected, reselect only one, mocked save only selected row, saved rows locked');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

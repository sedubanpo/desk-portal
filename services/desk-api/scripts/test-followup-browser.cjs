const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const output=process.env.FOLLOWUP_TEST_OUTPUT||require('node:os').tmpdir();
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://followup.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}));await page.goto('https://followup.test/');await page.setContent('<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:30px;background:#f6f8f1;font-family:-apple-system,BlinkMacSystemFont,"Arial",sans-serif}*{box-sizing:border-box}</style><main id="test"></main></html>');
for(const m of require('node:fs').readFileSync(path.join(root,'docs/index.html'),'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))await page.addStyleTag({content:m[1]});
await page.addStyleTag({path:path.join(root,'docs/work-followup.css')});
await page.addScriptTag({path:path.join(root,'docs/work-followup.js')});
await page.evaluate(()=>{
const mk=(i,title,status,room,owner,next,type)=>({id:String(i).padStart(32,'0'),code:'WFU-'+i,title,status,rooms:[room],owners:owner?[owner]:[],nextAction:next,nextCheck:i===1?'2026-10-10':'2026-10-12',due:'',importance:'★★★★',type,related:i===1?'김하늘 [학교:반포고] [과목:수학]':'',evidence:'기존 대화 근거\n[2026-10-11 · 실무자] 확인 진행 중',version:'v1',url:'https://www.notion.so/'+String(i).padStart(32,'0'),editedAt:'2026-10-11T02:30:00Z',ownerConfirmation:'원문 명시',ownerOriginal:'',situation:'원문과 실제 처리 상태를 대조합니다.',completion:'담당자 확인과 결과 기록',resolution:'',firstEvidence:'2026-10-10',latestEvidence:'2026-10-11',sourceLocation:'대화.csv · CSV 레코드 7',mergeTarget:[]});
const rows=[mk(1,'수학 수업 시간 변경 및 학부모 안내','진행 중','반포관 데스크','김담당','강사 가능 시간을 확인하고 확정 시간표 안내','일정·수업'),mk(2,'9월 중복 결제 정정 결과 확인','해결 확인 필요','수납 업무방','이실무','승인번호와 최종 환불 내역 대조','수납·환불'),mk(3,'교재 배송 지연 · 다음 입고일 확인','응답 대기','반포관 데스크','김담당','거래처 답변을 받고 학생에게 전달','자료·교재'),mk(4,'교실 콘센트 수리 후 작동 확인','확인 필요','시설 관리방','','수리 완료 사진과 현장 작동 여부 확인','시설·시스템'),mk(5,'신규 직원 마감 업무 인수인계','지속 관찰','운영 업무방','박관리','체크리스트 사용 후 일주일 간 점검','운영·인수인계')];
window.calls=[];window.mockRows=rows;
const message={at:'2026-10-11T01:30:00+09:00',sender:'김담당',text:'환불 확인 부탁드립니다.\n다음주 다시 연락\n<img src=x onerror=alert(1)>',location:'CSV 레코드 2',key:'key-1',type:'수납·환불',suggested:true,title:'환불 확인 부탁드립니다.',index:0};
window.view=DeskWorkFollowup.mount(document.querySelector('#test'),{base:'https://test.local',uid:'test',getToken:async()=> 'token',isAdmin:true,fetchImpl:async(url,init)=>{
const u=new URL(url);window.calls.push({path:u.pathname,query:u.search,body:init.body?JSON.parse(init.body):null});let r;
if(u.pathname.endsWith('/school-icons'))r={icons:[{displayName:'반포고',imageUrl:'',aliases:[]}]};
else if(u.pathname.endsWith('/meta'))r={rooms:['반포관 데스크','수납 업무방','시설 관리방','운영 업무방'],owners:['김담당','이실무','박관리']};
else if(u.pathname.endsWith('/save')){const body=JSON.parse(init.body);r={ok:true,item:{...rows[0],...body.patch}};}
else if(u.pathname.endsWith('/imports')&&init.method==='POST')r={batchId:'b'.repeat(64),room:'반포관 데스크',filename:'chat.csv',total:1,suggested:1,ignored:0};
else if(u.pathname.includes('/imports/')&&u.pathname.endsWith('/commit'))r={ok:true,item:{...rows[0],code:'WFU-24',title:'환불 확인'}};
else if(u.pathname.includes('/imports/'))r={batchId:'b'.repeat(64),room:'반포관 데스크',filename:'chat.csv',total:1,suggested:1,ignored:0,messages:[message]};
else if(/\/[0-9]{32}$/.test(u.pathname))r={item:rows.find(x=>u.pathname.endsWith(x.id))||rows[0]};
else r={items:rows,nextCursor:null,syncedAt:'2026-10-11T03:30:00Z',warning:''};
return new Response(JSON.stringify(r),{status:200,headers:{'Content-Type':'application/json'}});
}});view.load();
});
await page.getByRole('button',{name:'수학 수업 시간 변경 및 학부모 안내',exact:true}).waitFor();
await page.screenshot({path:path.join(output,'followup-desktop.png'),fullPage:true});
await page.getByRole('button',{name:'내 담당',exact:true}).click();await page.waitForTimeout(100);assert.ok((await page.evaluate(()=>calls.at(-1).query)).includes('view=mine'));
await page.getByRole('button',{name:'수학 수업 시간 변경 및 학부모 안내',exact:true}).click();
await page.waitForTimeout(200);await page.getByRole('dialog').getByLabel('다음 행동',{exact:true}).fill('새 결과 확인');await page.getByRole('dialog').getByRole('button',{name:'저장',exact:true}).click();await page.waitForTimeout(100);
const saved=await page.evaluate(()=>calls.find(c=>c.path.endsWith('/save')).body);assert.equal(saved.patch.nextAction,'새 결과 확인');assert.equal(saved.patch.rooms,undefined);assert.equal(saved.patch.title,undefined);
await page.getByRole('button',{name:'업무 등록',exact:true}).click();await page.getByRole('dialog').getByLabel('업무명',{exact:true}).fill('새 업무');await page.getByRole('dialog').getByLabel('소스방',{exact:true}).fill('반포관 데스크');await page.getByRole('dialog').getByRole('button',{name:'저장',exact:true}).click();await page.waitForTimeout(100);
await page.getByRole('button',{name:'대화 파일 가져오기',exact:true}).click();await page.getByRole('dialog').getByLabel('소스방',{exact:true}).fill('반포관 데스크');await page.getByRole('dialog').locator('input[type=file]').setInputFiles({name:'chat.csv',mimeType:'text/csv',buffer:Buffer.from('Date,User,Message\n2026-10-11 01:30:00,김담당,환불 확인 부탁')});await page.getByRole('button',{name:'원문 읽고 검토하기'}).click();await page.locator('[data-message]').click();
assert.equal(await page.locator('.wf-review img').count(),0);await page.locator('input[name=reviewed]').check();
await page.screenshot({path:path.join(output,'followup-import.png'),fullPage:true});
await page.getByRole('button',{name:'검토한 업무 등록',exact:true}).click();await page.getByText('노션에 반영했습니다.',{exact:true}).waitFor();
const commit=await page.evaluate(()=>calls.find(c=>c.path.endsWith('/commit')).body);assert.equal(commit.reviewed,true);assert.equal(commit.index,0);assert.equal(commit.slot,'0');
await page.getByRole('button',{name:'닫기',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'followup-mobile.png'),fullPage:true});
const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dims.scroll<=dims.width+1,JSON.stringify(dims));
await page.getByRole('button',{name:'수학 수업 시간 변경 및 학부모 안내',exact:true}).click();assert.ok(await page.locator('.wf-form-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(output,'followup-mobile-detail.png'),fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['filter','edit minimal patch','create','CSV review','XSS escaping','reviewed import','mobile width','Escape'],screenshots:[path.join(output,'followup-desktop.png'),path.join(output,'followup-import.png'),path.join(output,'followup-mobile.png'),path.join(output,'followup-mobile-detail.png')]}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

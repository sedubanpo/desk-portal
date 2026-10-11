import { createHash } from 'node:crypto';
import { ApiError } from '../http.js';
export const STATUSES = ['미해결','진행 중','응답 대기','해결 확인 필요','확인 필요','지속 관찰','해결','보류','병합'];
export const TYPES = ['학생·학부모 후속','일정·수업','수납·환불','자료·교재','시설·시스템','운영·인수인계','기타'];
export const CLOSED = ['해결','보류','병합'];
export const FIELDS = {title:'업무',status:'상태',importance:'중요도',type:'업무유형',rooms:'소스방',owners:'담당',ownerOriginal:'담당 원문',ownerConfirmation:'담당확인',situation:'현재상황',nextAction:'다음행동',completion:'완료조건',related:'관련대상',due:'기한',nextCheck:'다음확인',lastCheck:'마지막확인',firstEvidence:'최초근거일',latestEvidence:'최신근거일',resolvedAt:'해결일',dueEvidence:'기한근거',evidence:'근거',resolution:'해결증거',aliases:'기존표현·별칭',messageKeys:'원문메시지키',sourceLocation:'원문위치',dedupKey:'중복판별키',mergeTarget:'병합대상'};
const dates = new Set(['due','nextCheck','lastCheck','firstEvidence','latestEvidence','resolvedAt']);
const selects = {status:STATUSES,type:TYPES,importance:['★★★★★','★★★★','★★★','★★','★'],ownerConfirmation:['원문 명시','확인 필요','미확인']};
export const hash = value => createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const today = (now=new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function id(value) { const s=String(value||'').replace(/-/g,'');if(!/^[a-f\d]{32}$/i.test(s))throw new ApiError(400,'invalid_id','업무 번호를 확인해 주세요.');return s; }
export function textValue(p) { if(!p)return '';if(p.type==='unique_id'||p.unique_id)return p.unique_id?`${p.unique_id.prefix||'WFU'}-${p.unique_id.number}`:'';if(p.multi_select)return p.multi_select.map(v=>v.name);if(p.relation)return p.relation.map(v=>v.id);if(p.date)return p.date.start||'';if(p.select||p.status)return (p.select||p.status).name;return (p.title||p.rich_text||[]).map(t=>t.plain_text??t.text?.content??'').join(''); }
export const rich = value => {const s=Array.from(String(value||''));return Array.from({length:Math.ceil(s.length/950)},(_,i)=>({type:'text',text:{content:s.slice(i*950,(i+1)*950).join('')}}));};
export function normalize(page){const p=page.properties||{};const item=Object.fromEntries(Object.entries(FIELDS).map(([k,n])=>[k,textValue(p[n])]));item.rooms=Array.isArray(item.rooms)?item.rooms:[];item.owners=Array.isArray(item.owners)?item.owners:[];item.mergeTarget=Array.isArray(item.mergeTarget)?item.mergeTarget.map(id):[];return {...item,id:id(page.id),code:textValue(p['업무 ID']),version:hash(p),editedAt:page.last_edited_time||'',url:`https://www.notion.so/${id(page.id)}`,archived:!!(page.in_trash||page.archived)};}
export function validatePatch(input){if(!input||Array.isArray(input)||typeof input!=='object')throw new ApiError(400,'invalid_patch','입력 내용을 확인해 주세요.');const out={};for(const [k,v] of Object.entries(input)){
 if(!Object.hasOwn(FIELDS,k)||['messageKeys','sourceLocation','evidence','firstEvidence','latestEvidence','lastCheck','resolvedAt','mergeTarget'].includes(k))throw new ApiError(400,'invalid_field','수정할 수 없는 항목입니다.');
 if(['rooms','owners'].includes(k)){if(!Array.isArray(v)||v.length>20||v.some(s=>typeof s!=='string'||!s.trim()||s.length>100||s.includes(',')))throw new ApiError(400,'invalid_labels','라벨을 확인해 주세요.');out[k]=[...new Set(v.map(s=>s.trim()))];continue;}
 if(typeof v!=='string'||v.length>(['title','related','nextAction'].includes(k)?1000:12000))throw new ApiError(400,'invalid_text','입력한 내용이 너무 깁니다.');out[k]=v.trim();
 if(k==='title'&&!out[k])throw new ApiError(400,'title_required','업무명을 입력해 주세요.');
 if(selects[k]&&!selects[k].includes(v))throw new ApiError(400,'invalid_option','상태 또는 분류를 확인해 주세요.');
 if(dates.has(k)&&v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))throw new ApiError(400,'invalid_date','올바른 날짜를 입력해 주세요.');
 }return out;}
export function properties(patch){return Object.fromEntries(Object.entries(patch).map(([k,v])=>{if(!FIELDS[k])throw new Error('Unknown field');if(['evidence','messageKeys','sourceLocation'].includes(k)&&String(v).length>90000)throw new ApiError(400,'history_full','이 업무의 근거가 많아 노션에서 정리가 필요합니다. 기존 근거는 보존됩니다.');return [FIELDS[k],k==='title'?{title:rich(v)}:dates.has(k)?{date:v?{start:v}:null}:selects[k]?{select:v?{name:v}:null}:['rooms','owners'].includes(k)?{multi_select:v.map(name=>({name}))}:k==='mergeTarget'?{relation:v.map(id=>({id}))}:{rich_text:rich(v)}];}));}
export function compact(r){return Object.fromEntries(['id','code','title','status','importance','type','rooms','owners','nextAction','nextCheck','due','related','editedAt','url'].map(k=>[k,typeof r[k]==='string'?r[k].slice(0,1000):r[k]]));}
export function buildQuery(input={},actor={},now=new Date()){
 const and=[], add=(property,kind,condition)=>and.push({property,[kind]:condition});
 const view=String(input.view||'active');if(!['active','mine','today','overdue','unassigned','unscheduled','verify','watch','closed','all'].includes(view))throw new ApiError(400,'invalid_view','보기 조건을 확인해 주세요.');
 if(view==='closed')and.push({or:CLOSED.map(s=>({property:'상태',select:{equals:s}}))});else if(view!=='all')for(const s of CLOSED)add('상태','select',{does_not_equal:s});
 if(input.status){if(!STATUSES.includes(input.status))throw new ApiError(400,'invalid_status','상태를 확인해 주세요.');add('상태','select',{equals:input.status});}
 if(input.type){if(!TYPES.includes(input.type))throw new ApiError(400,'invalid_type','유형을 확인해 주세요.');add('업무유형','select',{equals:input.type});}
 for(const [key,n] of [['room','소스방'],['owner','담당']])if(input[key]){if(typeof input[key]!=='string'||input[key].length>100)throw new ApiError(400,'invalid_filter','필터를 확인해 주세요.');add(n,'multi_select',{contains:input[key]});}
 if(view==='mine'){const names=[...new Set([actor.name,actor.nickname].filter(Boolean))];and.push({or:(names.length?names:['__unassigned_user__']).map(name=>({property:'담당',multi_select:{contains:name}}))});}
 if(view==='unassigned')and.push({or:[{property:'담당',multi_select:{is_empty:true}},{property:'담당',multi_select:{contains:'미확인'}}]});
 if(view==='unscheduled')add('다음확인','date',{is_empty:true});
 if(view==='today')add('다음확인','date',{equals:today(now)});
 if(view==='overdue')add('다음확인','date',{before:today(now)});
 if(view==='verify')add('상태','select',{equals:'해결 확인 필요'});
 if(view==='watch')add('상태','select',{equals:'지속 관찰'});
 if(input.importance){if(!selects.importance.includes(input.importance))throw new ApiError(400,'invalid_importance','중요도를 확인해 주세요.');add('중요도','select',{equals:input.importance});}
 for(const [key,condition] of [['from','on_or_after'],['to','on_or_before']])if(input[key]){validatePatch({nextCheck:input[key]});add('다음확인','date',{[condition]:input[key]});}if(input.from&&input.to&&input.from>input.to)throw new ApiError(400,'invalid_range','확인일 범위의 시작일과 종료일을 확인해 주세요.');
 const q=String(input.q||'').trim();if(q.length>120)throw new ApiError(400,'search_too_long','검색어를 120자 이내로 입력해 주세요.');if(q){if(/^WFU-\d+$/i.test(q))add('업무 ID','unique_id',{equals:Number(q.split('-')[1])});else and.push({or:['업무','관련대상','다음행동'].map(n=>({property:n,[n==='업무'?'title':'rich_text']:{contains:q}}))});}
 if(input.cursor&&(typeof input.cursor!=='string'||input.cursor.length>200))throw new ApiError(400,'invalid_cursor','페이지를 다시 열어 주세요.');
 return {page_size:30,...(and.length?{filter:{and}}:{}),sorts:[{property:'다음확인',direction:'ascending'},{property:'중요도',direction:'ascending'},{timestamp:'last_edited_time',direction:'descending'}],...(input.cursor?{start_cursor:input.cursor}:{})};
}

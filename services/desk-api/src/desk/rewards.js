import {createHash} from 'node:crypto';
const path='desk_portal/student_rewards';
const validMonth=v=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(v||'');
const fail=message=>({success:false,message});
export function createRewardMethods({store,loadRewardStudents=async()=>[],now=()=>new Date().toISOString()}){
 return {
  async getDeskRewardStudents(){return {success:true,students:await loadRewardStudents()};},
  async getDeskRewards({month}={}){if(!validMonth(month))return fail('조회 월을 확인해 주세요.');const rows=Object.values(await store.get(path+'/'+month)||{});return {success:true,records:rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};},
  async saveDeskReward({month,id,version,record={}}={},actor={}){
   if(!['ADMIN','STAFF','DESK'].includes(actor.role))return fail('데스크 근무자만 기록할 수 있습니다.');
   if(!validMonth(month)||! /^[a-zA-Z0-9-]{16,80}$/.test(id||''))return fail('저장 정보를 확인해 주세요.');
   const strings=['studentId','reason','detail','item','kind','deliveryMethod','deliveredAt','approver','approvalDate','approvalNote','cardCompany','cardLast4','note','status'];
   if(strings.some(k=>record[k]!==undefined&&(typeof record[k]!=='string'||record[k].length>2000)))return fail('입력 내용을 확인해 주세요.');
   if(!['친구 추천','성적 향상','기타'].includes(record.reason)||!['기프티콘','사은품','기타'].includes(record.kind)||!record.item?.trim())return fail('지급 사유와 보상 품목을 입력해 주세요.');
   if(!['전달 예정','전달 완료','취소'].includes(record.status))return fail('전달 상태를 확인해 주세요.');
   if(record.approver&&!['대표님','원장님','부원장님'].includes(record.approver))return fail('구두 승인자는 대표님·원장님·부원장님 중 선택해 주세요.');
   if(record.cardLast4&&!/^\d{4}$/.test(record.cardLast4))return fail('카드번호는 끝 4자리만 입력해 주세요.');
   if(!Number.isSafeInteger(record.amount)||record.amount<0||record.amount>100000000||!Number.isSafeInteger(record.quantity)||record.quantity<1||record.quantity>10000)return fail('금액과 수량을 확인해 주세요.');
   for(const key of ['deliveredAt','approvalDate'])if(record[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(record[key])||!Number.isFinite(Date.parse(record[key]))||new Date(record[key]).toISOString().slice(0,10)!==record[key]))return fail('날짜를 확인해 주세요.');
   if(record.status==='전달 완료'&&(!record.deliveredAt||!record.deliveryMethod?.trim()))return fail('전달 완료일과 전달 방식을 입력해 주세요.');
   const students=await loadRewardStudents(),student=students.find(s=>s.id===record.studentId);
   const stamp=now(),actorName=String(actor.name||actor.nickname||'근무자');let result;
   const data=Object.fromEntries(strings.map(k=>[k,String(record[k]||'').trim()]));data.amount=record.amount;data.quantity=record.quantity;
   const fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex');
   await store.transaction(path+'/'+month+'/'+id,before=>{
    if(!student&&(!before||before.studentId!==record.studentId)){result=fail('재원생 목록에서 학생을 선택해 주세요.');return before??null;}
    if(before?.fingerprint===fingerprint){result={success:true,record:before};return before;}
    if((before?.version||0)!==(version||0)){result=fail('다른 근무자가 수정했습니다. 목록을 새로고침한 뒤 다시 열어 주세요.');return before??null;}
    const next={...data,id,month,studentName:student?.name||before.studentName,school:student?.school||before?.school||'',grade:student?.grade||before?.grade||'',createdAt:before?.createdAt||stamp,createdBy:before?.createdBy||actorName,createdByUid:before?.createdByUid||String(actor.uid||''),updatedAt:stamp,updatedBy:actorName,version:(before?.version||0)+1,fingerprint};
    next.history={...(before?.history||{}),['v'+next.version]:{at:stamp,by:actorName,uid:String(actor.uid||''),changes:strings.concat(['amount','quantity']).filter(k=>before?.[k]!==next[k]).map(k=>({field:k,before:before?.[k]??'',after:next[k]}))}};
    result={success:true,record:next};return next;
   });return result||fail('저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
  }
 };
}

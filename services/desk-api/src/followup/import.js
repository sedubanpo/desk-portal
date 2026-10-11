import { ApiError } from '../http.js';
import { hash } from './model.js';
const bad = message => {throw new ApiError(400,'invalid_chat_file',message);};
export function csvRows(text){const rows=[];let row=[],field='',quoted=false,closed=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}else if(c==='"'&&!field&&!closed)quoted=true;else if(c===','){row.push(field);field='';closed=false;}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';closed=false;}else {if(closed&&c!=='\r'&&c!==' ')bad('CSV 따옴표 형식을 확인해 주세요.');field+=c;}}if(quoted)bad('CSV의 닫히지 않은 따옴표를 확인해 주세요.');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}return rows;}
export function chatTime(value,date=''){
 let s=String(value).trim().replace(/년\s*|월\s*/g,'-').replace(/일/g,'').replace(/\./g,'-');
 const d=s.match(/(20\d{2})[-/]\s*(\d{1,2})[-/]\s*(\d{1,2})/);const day=d?`${d[1]}-${d[2].padStart(2,'0')}-${d[3].padStart(2,'0')}`:date;
 const t=s.match(/(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);if(!day||!t)return '';
 let h=Number(t[2]);const ampm=(t[1]||t[5]||'').toUpperCase();if(ampm){if(h<1||h>12)return '';h=h%12+(['오후','PM'].includes(ampm)?12:0);}if(h>23||Number(t[3])>59||Number(t[4]||0)>59)return '';
 if(!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)return '';
 return `${day}T${String(h).padStart(2,'0')}:${t[3]}:${t[4]||'00'}+09:00`;
}
function typeOf(text){return /환불|수납|결제|수강료/.test(text)?'수납·환불':/교재|자료|블로그/.test(text)?'자료·교재':/시설|수리|시스템|오류|로그인/.test(text)?'시설·시스템':/수업|시간표|스케줄|일정/.test(text)?'일정·수업':/상담|학부모|학생/.test(text)?'학생·학부모 후속':'운영·인수인계';}
export function parseChat({text,filename,room}){
 if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>5*1024*1024)bad('5MB 이하의 CSV/TXT 파일을 선택해 주세요.');
 if(typeof room!=='string'||!room.trim()||room.length>100||room.includes(','))bad('소스방 이름을 입력해 주세요.');
 if(typeof filename!=='string'||filename.length>200||! /\.(csv|txt)$/i.test(filename))bad('CSV 또는 TXT 파일만 지원합니다.');
 if(text.includes('\ufffd'))bad('한글 인코딩을 확인해 주세요. UTF-8 또는 EUC-KR로 다시 읽을 수 있습니다.');
 const source=text.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n'), messages=[];let ignored=0;
 const push=(time,sender,body,location)=>{if(!time||!sender?.trim()){ignored++;return;}if(!body.trim())return;if(body.length>16000)bad(`${location} 메시지가 너무 깁니다. 16,000자 이하로 나누어 주세요.`);const m={at:time,sender:sender.trim(),text:body.trim(),location};m.key=hash([room.trim(),m.at,m.sender,m.text]);m.suggested=!/^(사진|동영상|이모티콘|삭제된 메시지입니다[.]?)$/.test(m.text)&&/확인|부탁|해주세요|해 주세요|필요|요청|진행|미납|환불|누락|오류|전달|준비|일정|수정|처리|점검|완료/.test(m.text);m.type=typeOf(m.text);m.title=m.text.split('\n').find(Boolean).slice(0,140);messages.push(m);};
 if(/\.csv$/i.test(filename)){
  const rows=csvRows(source);const heads=(rows.shift()||[]).map(h=>h.trim().toLowerCase());const find=names=>heads.findIndex(h=>names.includes(h));const ti=find(['date','datetime','time','날짜','일시','시간']),si=find(['user','sender','name','보낸사람','보낸 사람','발신자','이름']),bi=find(['message','content','text','메시지','내용','대화내용']);
  if([ti,si,bi].some(i=>i<0))bad('CSV 머리글에 Date/User/Message 또는 날짜/이름/내용 열이 필요합니다.');
  rows.forEach((r,i)=>{if(r.some(v=>v.trim()))push(chatTime(r[ti]),r[si],r[bi]||'',`CSV 레코드 ${i+2}`);});
 }else{
  let date='',pending=null;const flush=()=>{if(pending)push(pending.at,pending.sender,pending.body,pending.location);pending=null;};
  source.split('\n').forEach((line,i)=>{
   const day=line.match(/^-*\s*(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/);if(day){flush();date=`${day[1]}-${day[2].padStart(2,'0')}-${day[3].padStart(2,'0')}`;return;}
   const pc=line.match(/^\[([^\]]+)\]\s*\[((?:오전|오후|AM|PM)?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s?(.*)$/i);
   const mobile=line.match(/^(20\d{2}[년.\-/].*?\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*,\s*(.+?)\s*:\s?(.*)$/i);
   if(pc||mobile){flush();pending={at:chatTime(pc?pc[2]:mobile[1],date),sender:pc?pc[1]:mobile[2],body:pc?pc[3]:mobile[3],location:`TXT ${i+1}행`};return;}
   if(pending)pending.body+='\n'+line;else if(line.trim())ignored++;
  });flush();
 }
 if(!messages.length)bad('날짜·발신자·내용을 읽을 수 없습니다. 카카오톡 대화 내보내기 형식을 확인해 주세요.');if(messages.length>20000)bad('한 번에 20,000개 이하의 메시지를 가져와 주세요.');
 const unique=[...new Map(messages.map(m=>[m.key,m])).values()];return {room:room.trim(),filename,messages:unique,ignored,duplicates:messages.length-unique.length,suggested:unique.filter(m=>m.suggested).length,from:unique.reduce((a,m)=>a<m.at?a:m.at,unique[0].at),to:unique.reduce((a,m)=>a>m.at?a:m.at,unique[0].at)};
}

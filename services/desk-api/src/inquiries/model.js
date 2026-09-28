import { createHash } from 'node:crypto';
import { ApiError } from '../http.js';
export const FIELDS = {
 name: '이름', school: '학교', grade: '학년', phone: '학부모 전화번호', subjects: '수강 희망 과목',
 consultation: '대표님 상담내용', notes: '특이사항', legacyFollowup: '재연락 기록', legacyStatus: '상태',
 owner: '문의 담당자', stage: '문의 진행상태', followup: '재연락 관리', nextDate: '다음 연락일', nextAction: '다음 할 일',
 lastContact: '최근 연락일', lastResult: '최근 연락 결과', stageNote: '진행상황 비고'
};
export const STAGES = ['상담 중', '연락두절', '타원 등록', '연락 보류', '재연락 대상', '신규', '상담 예약', '등록 완료', '종료'];
export const FOLLOWUPS = ['재연락 필요', '재연락 안 함', '연락금지'];
export const METHODS = ['전화','카톡','문자'];
export const RESULTS = ['통화 완료', '부재', '문자 보냄', '답변 받음', '카톡 보냄'];
export const EXTRA_SCHEMA = {
 '진행상황 비고': { rich_text: {} }, '문의 담당자': { rich_text: {} }, '문의 진행상태': { select: { options: STAGES.map(name => ({ name })) } },
 '재연락 관리': { select: { options: FOLLOWUPS.map(name => ({ name })) } },
 '다음 연락일': { date: {} }, '다음 할 일': { rich_text: {} }, '최근 연락일': { date: {} },
 '최근 연락 결과': { select: { options: RESULTS.map(name => ({ name })) } }
};
export const cleanId = value => { if (typeof value !== 'string' || !/^[a-f0-9]{32}$/i.test(value.replaceAll('-', ''))) throw new ApiError(400, 'invalid_id', '잘못된 문의 ID입니다.'); return value.replaceAll('-', ''); };
export const sameId = (a, b) => String(a || '').replaceAll('-', '') === String(b || '').replaceAll('-', '');
export const textValue = p => {
 if (!p) return '';
 const v = p[p.type];
 if (['title', 'rich_text'].includes(p.type)) return (v || []).map(t => t.plain_text ?? t.text?.content ?? '').join('');
 if (['select', 'status'].includes(p.type)) return v?.name || '';
 if (p.type === 'multi_select') return (v || []).map(o => o.name).join(', ');
 if (p.type === 'date') return v?.start || '';
 if (p.type === 'checkbox') return v ? '완료' : '미완료';
 if (p.type === 'created_time' || p.type === 'last_edited_time') return v || '';
 if (p.type === 'formula') return v ? String(v[v.type] ?? '') : '';
 if (p.type === 'number') return v == null ? '' : String(v);
 return typeof v === 'string' ? v : '';
};
export const pageVersion = page => createHash('sha256').update(JSON.stringify([page.last_edited_time,page.properties,!!page.in_trash])).digest('hex');
export function normalize(page) {
 const result = Object.fromEntries(Object.entries(FIELDS).map(([key, name]) => [key, textValue(page.properties?.[name])]));
 const subjectProp = page.properties?.[FIELDS.subjects];
 result.subjects = subjectProp?.type === 'multi_select' ? subjectProp.multi_select.map(s => s.name) : result.subjects.split(/[,，]/).map(s => s.trim()).filter(Boolean);
 result.stage ||= ['신규등원','압구정관 등록'].includes(result.legacyStatus) ? '등록 완료' : ['타원등록'].includes(result.legacyStatus) ? '타원 등록' : ['등원예정','상담예정'].includes(result.legacyStatus) ? '상담 예약' : /완료|연락|상담/.test(result.legacyStatus) ? '상담 중' : '신규';
 if(result.lastContact) result.lastContact=new Date(result.lastContact).toISOString();
 result.nextDate=result.nextDate.slice(0,10);
 result.followup ||= result.legacyStatus === '연락금지' ? '연락금지' : '재연락 필요';
 return { ...result, extras:Object.entries(page.properties || {}).filter(([name])=>!Object.values(FIELDS).includes(name)).map(([name,p])=>({name,value:textValue(p) || (['button','relation','rollup','files'].includes(p.type)?'노션 원본에서 확인':''),type:p.type})), id: cleanId(page.id), url: `https://www.notion.so/${cleanId(page.id)}`, createdAt: page.created_time, firstContact: textValue(page.properties?.['입력 시간']) || page.created_time,
 version: pageVersion(page),
 trashed: !!(page.in_trash || page.archived), editedAt: page.last_edited_time };
}
export function validatePatch(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'invalid_input', '입력 내용을 확인해 주세요.');
 const allowed = ['name','school','grade','phone','subjects','consultation','notes','owner','stage','followup','nextDate','nextAction','stageNote'];
 const out = {};
 for (const [key, value] of Object.entries(input)) {
  if (!allowed.includes(key)) throw new ApiError(400, 'invalid_field', '수정할 수 없는 항목입니다.');
  if (key === 'subjects') {
   if (!Array.isArray(value) || value.length > 20 || value.some(v => typeof v !== 'string' || !v.trim() || v.length > 100)) throw new ApiError(400, 'invalid_subjects', '희망 과목을 확인해 주세요.');
   out[key] = [...new Set(value.map(v => v.trim()))]; continue;
  }
  if (typeof value !== 'string' || value.length > (['consultation','notes','stageNote'].includes(key) ? 20000 : 500)) throw new ApiError(400,'invalid_text','입력 길이를 확인해 주세요.');
  out[key] = value.trim();
 }
 for (const [key, options] of [['stage',STAGES],['followup',FOLLOWUPS]]) if (key in out && !options.includes(out[key])) throw new ApiError(400,'invalid_choice','상태를 확인해 주세요.');
 if ('name' in out && !out.name) throw new ApiError(400,'name_required','이름을 입력해 주세요.');
 if ('grade' in out && out.grade !== '') {if(!/^\d{1,2}$/.test(out.grade)||Number(out.grade)>20)throw new ApiError(400,'invalid_grade','학년은 0~20 사이의 숫자로 입력해 주세요.');out.grade=String(Number(out.grade));}
 if (out.nextDate && (!/^\d{4}-\d{2}-\d{2}$/.test(out.nextDate) || !Number.isFinite(Date.parse(out.nextDate)) || new Date(out.nextDate).toISOString().slice(0,10) !== out.nextDate)) throw new ApiError(400,'invalid_date','올바른 날짜를 입력해 주세요.');
 return out;
}
export const richText = value => Array.from({length:Math.ceil(value.length / 1900)}, (_,i) => ({type:'text',text:{content:value.slice(i*1900,(i+1)*1900)}}));
export function notionProperties(patch, schema) {
 const props = {};
 for (const [key, value] of Object.entries(patch)) {
  const name = FIELDS[key], def = schema.properties[name];
  if (!def) throw new ApiError(503,'schema_required',`노션에 ${name} 속성을 연결해야 합니다.`);
  let v;
  switch (def.type) {
   case 'title': case 'rich_text': v = richText(Array.isArray(value) ? value.join(', ') : value); break;
   case 'select': case 'status': v = value ? {name:value} : null; break;
   case 'multi_select': v = (Array.isArray(value) ? value : value ? [value] : []).map(name => ({name})); break;
   case 'date': v = value ? {start:value} : null; break;
   case 'phone_number': case 'url': v = value || null; break;
   case 'number': v = value === '' ? null : Number(value); if (v !== null && !Number.isFinite(v)) throw new ApiError(400,'invalid_number',`${name}에는 숫자를 입력해 주세요.`); break;
   default: throw new ApiError(400,'read_only_property',`${name}은 노션에서 직접 수정해야 하는 속성입니다.`);
  }
  props[def.id || name] = {[def.type]:v};
 }
 return props;
}

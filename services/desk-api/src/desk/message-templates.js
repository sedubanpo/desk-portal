import { randomUUID } from 'node:crypto';
import { ApiError } from '../http.js';
const fields = {templates:['id','tagId','target','title','tone','message'],tags:['id','label','target','icon','description','procedure']};
const invalid = message => { throw new ApiError(400, 'invalid_message_templates', message); };
// Audit entries and attribution are owned by the server, including for legacy clients.
export function prepareMessageTemplates(input, current, identity, now) {
  if (!input || !Array.isArray(input.templates) || !Array.isArray(input.tags)) invalid('문구와 태그 목록이 필요합니다.');
  const stamp = now();
  const actor = {uid:String(identity.uid || ''),name:String(identity.name || '')};
  const history = {...(current?.history || {})};
  const result = {history};
  for (const kind of ['tags','templates']) {
    const seen = new Set();
    const clean = row => Object.fromEntries(fields[kind].map(key => [key,String(row?.[key] ?? '').trim()]));
    const old = new Map((current?.[kind] || []).map(row => [row.id,row]));
    result[kind] = input[kind].map(row => {
      const value = clean(row);
      if (!value.id || seen.has(value.id)) invalid('문구 또는 태그 ID가 중복되거나 비어 있습니다.');
      if (!value[kind === 'tags' ? 'label' : 'title'] || (kind === 'templates' && !value.message)) invalid('제목과 내용을 입력해 주세요.');
      if (Object.values(value).some(text => text.length > 20000)) invalid('문구는 20,000자 이내로 입력해 주세요.');
      seen.add(value.id);
      const previous = old.get(value.id);
      const changed = !previous || JSON.stringify(clean(previous)) !== JSON.stringify(value);
      const metadata = previous ? Object.fromEntries(['createdAt','createdBy','createdByUid','updatedAt','updatedBy','updatedByUid'].filter(key=>previous[key]).map(key=>[key,previous[key]])) : {createdAt:stamp,createdBy:actor.name,createdByUid:actor.uid};
      if (changed) {
        const id = randomUUID();
        history[id] = {id,entity:kind,entityId:value.id,action:previous?'update':'create',title:value.title || value.label,actorUid:actor.uid,actorName:actor.name,at:stamp,before:previous?clean(previous):null,after:value};
        Object.assign(metadata,{updatedAt:stamp,updatedBy:actor.name,updatedByUid:actor.uid});
      }
      return {...value,...metadata};
    });
    for (const previous of old.values()) if (!seen.has(previous.id)) {
      const id = randomUUID();
      history[id] = {id,entity:kind,entityId:previous.id,action:'delete',title:previous.title || previous.label,actorUid:actor.uid,actorName:actor.name,at:stamp,before:clean(previous),after:null};
    }
  }
  return result;
}

import json,subprocess,urllib.request,urllib.error,pathlib
import argparse
parser=argparse.ArgumentParser(description='Prepare approved inquiry schema and contact history database without editing inquiry records')
parser.add_argument('--output',required=True,help='Path for non-secret history database/source IDs')
args=parser.parse_args()
token=subprocess.check_output(['gcloud','secrets','versions','access','latest','--secret=ACCOUNT_MANAGEMENT_NOTION_TOKEN','--project=fir-lms-prod'],text=True).strip()
def api(path,method='GET',body=None):
 req=urllib.request.Request('https://api.notion.com/v1'+path,method=method,headers={'Authorization':'Bearer '+token,'Notion-Version':'2025-09-03','Content-Type':'application/json'},data=json.dumps(body).encode() if body is not None else None)
 try:return json.load(urllib.request.urlopen(req))
 except urllib.error.HTTPError as e:
  data=json.load(e);raise RuntimeError(str(e.code)+' '+data.get('message',''))
source='5a9e0b14-58d8-4163-812b-48e4df51dcbc'
schema=api('/data_sources/'+source)
def select(values):return {'select':{'options':[{'name':v} for v in values]}}
extra={'진행상황 비고':{'rich_text':{}},'문의 담당자':{'rich_text':{}},'문의 진행상태':select(['상담 중','연락두절','타원 등록','연락 보류','재연락 대상','신규','상담 예약','등록 완료','종료']),'재연락 관리':select(['재연락 필요','재연락 안 함','연락금지']),'다음 연락일':{'date':{}},'다음 할 일':{'rich_text':{}},'최근 연락일':{'date':{}},'최근 연락 결과':select(['통화 완료','부재','문자 보냄','답변 받음','카톡 보냄'])}
missing={k:v for k,v in extra.items() if k not in schema['properties']}
if missing:
 api('/data_sources/'+source,'PATCH',{'properties':missing});print('Added schema fields:',list(missing))
else:print('Schema fields already ready')
# Append options, preserving existing option IDs and colors.
for name in ['문의 진행상태','최근 연락 결과']:
 current=schema['properties'].get(name,{}).get('select',{}).get('options',[])
 wanted=extra[name]['select']['options']
 additions=[o for o in wanted if o['name'] not in [v['name'] for v in current]]
 if additions:api('/data_sources/'+source,'PATCH',{'properties':{name:{'select':{'options':current+additions}}}})
parent='177d8b6280e780359cf1d22f17d6749e'
try:api('/pages/'+parent)
except RuntimeError:
 print('History DB: waiting for parent page connection');raise SystemExit(0)
# Discover an existing direct child by title before creating; never duplicate on rerun.
children=[];cursor=None
while True:
 d=api('/blocks/'+parent+'/children?page_size=100'+('&start_cursor='+cursor if cursor else ''));children+=d['results'];cursor=d.get('next_cursor') if d.get('has_more') else None
 if not cursor:break
existing=[c for c in children if c.get('type')=='child_database' and c.get('child_database',{}).get('title')=='신규문의 연락 이력']
if existing:d=api('/databases/'+existing[0]['id'])
else:
 props={'이름':{'title':{}},'문의':{'relation':{'data_source_id':source,'single_property':{}}},'요청 ID':{'rich_text':{}},'연락 결과':select(['통화 완료','부재','문자 보냄','답변 받음','카톡 보냄']),'메모':{'rich_text':{}},'기록자':{'rich_text':{}},'연락 시각':{'date':{}},'기록 시각 원본':{'rich_text':{}},'기록 상태':select(['유효','취소']),'수정자':{'rich_text':{}},'수정 시각':{'date':{}}}
 d=api('/databases','POST',{'parent':{'type':'page_id','page_id':parent},'title':[{'type':'text','text':{'content':'신규문의 연락 이력'}}],'is_inline':False,'initial_data_source':{'properties':props}})
history_source=d['data_sources'][0]['id']
history_schema=api('/data_sources/'+history_source)
if '기록 시각 원본' not in history_schema['properties']:api('/data_sources/'+history_source,'PATCH',{'properties':{'기록 시각 원본':{'rich_text':{}}}})
if '연락 방법' not in history_schema['properties']:api('/data_sources/'+history_source,'PATCH',{'properties':{'연락 방법':select(['전화','카톡','문자'])}})
print('History database:',d['id']);print('History sources:',d.get('data_sources'))
pathlib.Path(args.output).write_text(json.dumps({'databaseId':d['id'],'sourceId':d['data_sources'][0]['id']}))

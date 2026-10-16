import {validOfficeDate} from './office.js';
// Short, authenticated streams fit the service's existing 30s request timeout.
export function officeStream(office){
 return (req,res)=>{
  const date=String(req.query.dateKey||'');
  if(!validOfficeDate(date))return res.status(400).json({error:{message:'날짜를 확인해 주세요.'}});
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();
  let closed=false,busy=false,dirty=false,stop=()=>{};
  const send=async()=>{
   if(closed)return;
   if(busy){dirty=true;return;}
   busy=true;
   try{const data=await office.snapshot(date);if(!closed)res.write('data: '+JSON.stringify(data)+'\n\n');}
   catch{if(!closed){res.write('event: unavailable\ndata: {}\n\n');res.end();}}
   finally{busy=false;if(dirty&&!closed){dirty=false;send();}}
  };
  const heartbeat=setInterval(()=>{if(!closed)res.write(': heartbeat\n\n');},8000);
  const lifetime=setTimeout(()=>res.end(),22000);
  const cleanup=()=>{closed=true;clearInterval(heartbeat);clearTimeout(lifetime);stop();};
  res.on('close',cleanup);
  try{stop=office.watch(date,send,()=>res.end());if(closed)stop();else send();}catch{res.end();}
 };
}

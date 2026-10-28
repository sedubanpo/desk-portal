import {validOfficeDate} from './office.js';
// One channel per date and service instance. Authentication remains per request.
// No snapshot cache survives a connection: joining requests request a fresh read.
export function officeStream(office){
 const channels=new Map();
 function channel(date){
  if(channels.has(date))return channels.get(date);
  const clients=new Set();
  let closed=false,busy=false,dirty=false,pending,stop=()=>{};
  const dispose=()=>{if(closed)return;closed=true;clearTimeout(pending);channels.delete(date);stop();};
  const finish=()=>{dispose();for(const res of [...clients])res.end();};
  const schedule=()=>{if(closed)return;dirty=true;if(!busy&&!pending)pending=setTimeout(send,50);};
  const send=async()=>{
   pending=null;if(closed)return;busy=true;dirty=false;
   try{
    const data=await office.snapshot(date);
    if(!closed){const event='data: '+JSON.stringify(data)+'\n\n';for(const res of [...clients]){
     // Disconnect slow clients instead of retaining an unbounded response buffer.
     if(!res.write(event))res.end();
    }}
   }catch{if(!closed){for(const res of [...clients])res.write('event: unavailable\ndata: {}\n\n');finish();}}
   finally{busy=false;if(dirty&&!closed)schedule();}
  };
  const group={add(res){clients.add(res);schedule();},remove(res){clients.delete(res);if(!clients.size)dispose();}};
  channels.set(date,group);
  try{stop=office.watch(date,schedule,finish);if(closed){stop();throw Error('Office subscription unavailable');}}
  catch(error){dispose();throw error;}
  return group;
 }
 return (req,res)=>{
  const date=String(req.query.dateKey||'');
  if(!validOfficeDate(date))return res.status(400).json({error:{message:'날짜를 확인해 주세요.'}});
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();
  let group,closed=false;
  const heartbeat=setInterval(()=>{if(!closed&&!res.write(': heartbeat\n\n'))res.end();},8000);
  // Preserve regular authentication checks and the existing 30s request limit.
  const lifetime=setTimeout(()=>res.end(),22000);
  res.on('close',()=>{closed=true;clearInterval(heartbeat);clearTimeout(lifetime);group?.remove(res);});
  try{group=channel(date);if(!closed)group.add(res);}catch{res.end();}
 };
}

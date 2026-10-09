(function(){
  'use strict';
  const actions=document.querySelector('#moduleTeacher .payroll-page-actions');
  const analysis=document.getElementById('openPayrollMonthlyAnalysisBtn');
  if(!actions||!analysis)return;
  const button=document.createElement('button');button.type='button';button.className='payroll-analysis-btn';button.id='getPayrollWorkbookExportBtn';button.textContent='월별 결산 엑셀';button.title='선택한 월의 전체 강사·수납·파트타임 근무시간을 기존 7개 시트 양식으로 내려받습니다.';actions.insertBefore(button,analysis);
  const status=document.createElement('div');status.setAttribute('role','status');status.style.cssText='font-size:12px;line-height:1.6;flex-basis:100%;text-align:right;white-space:normal';actions.appendChild(status);
  let busy=false;
  button.addEventListener('click',async()=>{
    if(busy)return;
    const month=state.selectedMonth;if(!month){status.textContent='정산 월을 먼저 선택해 주세요.';return;}
    busy=true;button.disabled=true;button.textContent='엑셀 생성 중…';status.textContent=month+' 전체 월 자료를 조회하고 있습니다.';
    try{
      const result=await runServer('getPayrollWorkbookExport',{monthName:month});
      if(!result||!result.success||!result.base64)throw new Error(result?.message||'엑셀 파일을 생성하지 못했습니다.');
      const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:result.mimeType}));
      const a=document.createElement('a');a.href=url;a.download=result.fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=`${month} · 7개 시트 · 수업 ${result.stats.lessons}건 출력. 운영비·별도 조정액은 직접 입력하세요.`+(result.warnings.length?' '+result.warnings.join(' / '):'');
    }catch(error){status.textContent='출력 실패: '+(error.message||String(error));}
    finally{busy=false;button.disabled=false;button.textContent='월별 결산 엑셀';}
  });
  window.addEventListener('payroll-locked',()=>{status.textContent='';});
})();

// Reports share the selected accounting month. Only the lesson report needs a separate read.
const TuitionSalesReport = (() => {
  const titles = {grades:'학년별 매출', closing:'결제일 결산', teachers:'강사별 매출'};
  const gradeOrder = [...'123456'].map(n=>'초'+n).concat(['중1','중2','중3','고1','고2','고3','기타']);
  const methods = {card:'카드',cash:'현금',unknown:'미분류'};
  const zero = {receipts:0,refunds:0,net:0,count:0};
  const won = value => formatWon(value || 0);
  function share(part,total) {
    if (total <= 0) return '—';
    const percent = part * 100 / total;
    return '<span class="sr-share"><i aria-hidden="true"><b style="width:'+Math.min(100,Math.max(0,percent))+'%"></b></i>'+percent.toFixed(1)+'%</span>';
  }
  let lastSelection, month, generation = 0;

  function table(headers, rows, footer='') {
    return '<div class="sr-scroll"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+
      '</tr></thead><tbody>'+rows+'</tbody>'+(footer?'<tfoot>'+footer+'</tfoot>':'')+'</table></div>';
  }
  function line(label, cells) {
    return '<tr><th scope="row">'+escapeHtml(label)+'</th>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
  }
  function statsCells(item,total) {
    return ['<strong>'+won(item.net)+'</strong>',share(item.net,total),item.count+'건',won(item.receipts),won(item.refunds)];
  }
  function headline(label, amount, note) {
    return '<div class="sr-headline"><div><span>'+label+'</span><strong>'+won(amount)+'</strong></div><p>'+escapeHtml(note)+'</p></div>';
  }
  const refundNames = {card:'카드 취소',cash:'현금 환불',unknown:'미분류 환불'};
  function refundType(entry) {
    const tender = entry.tender || methods[entry.method];
    return entry.method === 'card' ? tender+' 취소' : tender+' 환불';
  }
  function refundDetail(report, method) {
    const sums = new Map();
    for (const day of Object.values(report.days)) {
      for (const entry of day.entries || []) {
        if (entry.amount >= 0 || entry.method !== method) continue;
        const type = refundType(entry);
        sums.set(type,(sums.get(type)||0)-entry.amount);
      }
    }
    return [...sums].map(([type,n])=>escapeHtml(type)+' '+won(n)).join('<br>') || refundNames[method];
  }
  function calendar(report, selectedMonth) {
    const iso = '20'+selectedMonth, [year,m] = iso.split('-').map(Number);
    const first = new Date(Date.UTC(year,m-1,1)).getUTCDay();
    const length = new Date(Date.UTC(year,m,0)).getUTCDate();
    let cells = '<span aria-hidden="true"></span>'.repeat(first);
    for (let d=1;d<=length;d++) {
      const date=iso+'-'+String(d).padStart(2,'0'), day=report.days[date];
      const label=d+'일 · '+(day?'순수납 '+won(day.net):'거래 없음');
      cells+='<button type="button" data-day="'+date+'" aria-pressed="false" aria-label="'+label+'"><b>'+d+'</b><span class="sr-full">'+(day?won(day.net):'—')+'</span><span class="sr-short">'+(day?(day.net/10000).toLocaleString('ko-KR',{maximumFractionDigits:1}):'—')+'</span></button>';
    }
    return '<section class="sr-calendar"><header><div><h3>'+m+'월 일자별 결산</h3><small>날짜를 선택하면 거래 내역을 볼 수 있습니다.</small></div><small class="sr-short">단위 만원 · 반올림</small></header>'+
      '<div class="sr-grid">'+[...'일월화수목금토'].map(w=>'<strong>'+w+'</strong>').join('')+cells+'</div><div class="sr-day-detail"></div></section>';
  }
  function selectDay(body, report, date) {
    body.querySelectorAll('[data-day]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.day===date)));
    const day=report.days[date];
    let html='<h4>'+Number(date.slice(5,7))+'월 '+Number(date.slice(-2))+'일 거래 내역</h4>';
    if (day) {
      html+='<p>카드 '+won(day.card)+' · 현금 '+won(day.cash)+(day.unknown?' · 미분류 '+won(day.unknown):'')+' · <strong>순수납 '+won(day.net)+'</strong></p>';
      html+=day.entries ? table(['학생','거래 유형','금액'],day.entries.map(e=>line(e.student,[escapeHtml(e.amount<0?refundType(e):(e.tender||methods[e.method])+' 수납'),won(e.amount)])).join('')) : '<p>거래 상세를 보려면 수강료 데이터를 새로고침해 주세요.</p>';
    } else html+='<p>이 날짜에는 결제·환불 내역이 없습니다.</p>';
    body.querySelector('.sr-day-detail').innerHTML=html;
  }
  function closingImage(report, selectedMonth) {
    const canvas=document.createElement('canvas');
    canvas.width=720; canvas.height=1080;
    const ctx=canvas.getContext('2d');
    function text(value,x,y,size,weight=500,color='#233a31',align='left') {
      ctx.font=weight+' '+size+'px system-ui, sans-serif';
      ctx.fillStyle=color; ctx.textAlign=align; ctx.fillText(value,x,y,620);
    }
    const [year,m]=selectedMonth.split('-').map(Number);
    ctx.fillStyle='#f6f8f2'; ctx.fillRect(0,0,720,1080);
    ctx.fillStyle='#253e32'; ctx.fillRect(0,0,720,265);
    text('반포관  /  수강료 정산',44,56,24,600,'#dceacc');
    text((2000+year)+'년 '+m+'월 결제일 결산',44,113,39,700,'white');
    text('환불 차감 후 순수납액',44,169,22,500,'#dceacc');
    text(won(report.total.net),44,226,48,750,'white');
    const groups=[...Object.entries(methods).filter(([k])=>k!=='unknown'||report.methods[k]?.count),['total','전체']];
    groups.forEach(([key,label],i)=>{
      const row=key==='total'?report.total:report.methods[key]||zero;
      const y=310+i*176;
      text(label,44,y,30,700); text(row.count+'건',676,y,23,550,'#4c6054','right');
      ['수납액',refundNames[key]||'환불 합계','순수납액'].forEach((s,j)=>{
        text(s,48,y+35+j*34,24);text(won([row.receipts,row.refunds,row.net][j]),676,y+35+j*34,26,j===2?700:500,'#233a31','right');
      });
      ctx.fillStyle='#d7e0d4';ctx.fillRect(44,y+152,632,2);
    });
    text('실제 결제일 기준 · 수강료 정정 전표 제외',44,1033,22,500,'#526758');
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG 생성 실패')),'image/png'));
  }
  async function copyClosing(body, report, selectedMonth) {
    const status=body.querySelector('.sr-copy-status');
    status.textContent='이미지 준비 중…';
    try {
      const image=closingImage(report,selectedMonth);
      try {
        await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);
        status.textContent='결산 이미지를 복사했습니다.';
      } catch {
        const url=URL.createObjectURL(await image);
        const link=document.createElement('a');
        link.href=url; link.download='반포관_결제일결산_20'+selectedMonth+'.png'; link.click();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
        status.textContent='클립보드를 사용할 수 없어 PNG 파일로 저장했습니다.';
      }
    } catch { status.textContent='이미지를 만들지 못했습니다. 다시 시도해 주세요.'; }
  }
  function receipts(report, tab, undated) {
    const total = report.total;
    const amountRows = tab==='grades'
      ? gradeOrder.map(g=>line(g,statsCells(report.grades[g]||zero,total.net))).join('')
      : Object.entries(methods).map(([k,label])=>{
          const cells=statsCells(report.methods[k]||zero,total.net);
          cells[4]+='<small class="sr-refund">'+refundDetail(report,k)+'</small>';
          return line(label,cells);
        }).join('');
    const note = tab==='grades' ? '결제월 학생 명단의 학교와 학년을 기준으로 집계합니다. 명단에 없으면 수강료 귀속월 명단을 사용합니다.' :
      '카드는 현장카드·결제링크, 현금은 계좌이체·서울페이·제로페이·현금 등을 포함합니다.';
    const summary = headline('환불 차감 후 순수납액',total.net,note);
    const foot = line('전체',statsCells(total,total.net));
    const copy=tab==='closing'?'<div class="sr-copy"><span class="sr-copy-status" role="status"></span><button type="button" data-copy-closing>세로 이미지 복사</button></div>':'';
    return summary + copy + table([tab==='grades'?'학년':'결제수단','순수납액','비중','거래 건수','수납액','환불액'],amountRows,foot) +
      (tab==='closing'?calendar(report,month):'')+
      (total.count?'':'<p class="sr-note">이 달에는 결제일이 확인된 거래가 없습니다.</p>')+
      (undated?'<p class="sr-note">전체 원장 중 결제일을 확인할 수 없는 '+undated+'건은 결제일 통계에서 제외했습니다.</p>':'');
  }

  async function teacherReport(body, selected, version) {
    body.textContent='수업 원장을 조회하고 있습니다…';
    try {
      const data=await runServer('getTuitionTeacherSales',{monthName:selected});
      if (version!==generation) return;
      if (!data?.success) throw Error(data?.message || '수업 원장을 불러오지 못했습니다.');
      const rows=data.teachers;
      if (!rows.length) { body.textContent='이 달에 기록된 수업이 없습니다.'; return; }
      const totals=rows.reduce((sum,r)=>{
        for (const key of Object.keys(sum)) sum[key]+=r[key];
        return sum;
      },{count:0,gross:0,discount:0,net:0,pendingCount:0});
      const cells=r=>['<strong>'+won(r.net)+'</strong>',share(r.net,totals.net),r.count+'건',won(r.gross),won(r.discount),r.pendingCount+'건'];
      body.innerHTML=headline('할인 후 수업 청구액',totals.net,'학생별 수업 내역의 할인 후 금액을 수업일 기준으로 합산합니다. 금액 미확인 건은 별도로 표시합니다.')+
        table(['강사','할인 후 청구액','비중','수업 건수','할인 전 청구액','할인액','확인 필요'],rows.map(r=>line(r.name,cells(r))).join(''),line('전체',cells(totals)));
    } catch (error) {
      if (version!==generation) return;
      body.textContent=error.message+' ';
      const retry=document.createElement('button'); retry.type='button'; retry.textContent='다시 조회'; retry.onclick=()=>render(state.tuition.monthlySales,'teachers'); body.append(retry);
    }
  }
  function render(data,tab) {
    const version=++generation;
    const bar=document.getElementById('salesReportBar');
    bar.hidden=!titles[tab];
    if (bar.hidden) return;
    const months=[...new Set([...(data.availableMonths||[]),...(data.labels||[])])].sort().reverse();
    const selected=(state.tuition.selectedMonth||'').replace(/s$/,'');
    if (lastSelection!==selected || !months.includes(month)) month=months.includes(selected)?selected:months[0];
    lastSelection=selected;
    const picker=document.getElementById('salesReportMonth');
    picker.innerHTML=months.map(m=>'<option value="'+escapeHtml(m)+'">'+escapeHtml(formatTuitionMonthLabel_(m))+'</option>').join('');
    picker.value=month||''; picker.disabled=!months.length;
    picker.onchange=()=>{month=picker.value;render(data,tab);};
    const body=document.getElementById('salesBody-'+tab);
    if (!month) {body.textContent='조회할 월이 없습니다.'; return;}
    if (tab==='teachers') {teacherReport(body,month,version);return;}
    if (!data.breakdown) {body.textContent='수납 원장을 새로고침해 주세요.';return;}
    const report=data.breakdown.months[month] || {total:zero,methods:{},grades:{},days:{}};
    body.innerHTML=receipts(report,tab,data.breakdown.undated);
    if (tab==='closing') {
      selectDay(body,report,Object.keys(report.days).sort().at(-1)||'20'+month+'-01');
      body.onclick=event=>{
        const btn=event.target.closest('button');
        if (btn?.dataset.day) selectDay(body,report,btn.dataset.day);
        if (btn?.hasAttribute('data-copy-closing')) copyClosing(body,report,month);
      };
    }
  }
  return {render};
})();

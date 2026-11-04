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
  function receipts(report, tab, undated) {
    const total = report.total;
    const amountRows = tab==='grades'
      ? gradeOrder.map(g=>line(g,statsCells(report.grades[g]||zero,total.net))).join('')
      : Object.entries(methods).map(([k,label])=>line(label,statsCells(report.methods[k]||zero,total.net))).join('');
    const note = tab==='grades' ? '결제월 학생 명단의 학교와 학년을 기준으로 집계합니다. 명단에 없으면 수강료 귀속월 명단을 사용합니다.' :
      '카드는 현장카드·결제링크, 현금은 계좌이체·서울페이·제로페이·현금 등을 포함합니다.';
    const summary = headline('환불 차감 후 순수납액',total.net,note);
    const foot = line('전체',statsCells(total,total.net));
    const dates = Object.entries(report.days).sort(([a],[b])=>a.localeCompare(b));
    return summary + table([tab==='grades'?'학년':'결제수단','순수납액','비중','거래 건수','수납액','환불액'],amountRows,foot) +
      (tab==='closing' && dates.length ? '<details class="sr-days"><summary>일자별 결산 <small>'+dates.length+'일</small></summary>'+
        table(['결제일','카드','현금','미분류','순수납액'],dates.map(([d,v])=>line(d,[won(v.card),won(v.cash),won(v.unknown),won(v.net)])).join(''))+'</details>' : '')+
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
      body.innerHTML=headline('할인 후 수업 청구액',totals.net,'수업일 기준입니다. 당일취소는 포함하고 결석예고·당취보충·금액 확인 필요 건은 제외합니다.')+
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
  }
  return {render};
})();

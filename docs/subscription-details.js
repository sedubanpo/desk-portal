/* Presentation helpers shared by the subscription editor and report. */
(function () {
  'use strict';
  const cards = [
    ['visa','비자카드','visa.ico'],['shinhan','신한카드','shinhan.png'],['kb','KB국민카드','kb.ico'],
    ['samsung','삼성카드','samsung.png'],['hyundai','현대카드','hyundai.ico'],
    ['lotte','롯데카드','lotte.ico'],['woori','우리카드','woori.ico'],
    ['hana','하나카드','hana.ico'],['nh','NH농협카드','nh.png'],['bc','BC카드','bc.png']
  ];
  function cardName(id) { return (cards.find(c=>c[0]===id)||['','기타 카드'])[1]; }
  function cardLabel(card) { return card && card.issuer ? cardName(card.issuer)+(card.last4?' · '+card.last4:'') : '미입력'; }
  function cycleLabel(value) { return value==='monthly'?'매달':value==='yearly'?'매년':'주기 미입력'; }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
  function estimate(payment,fx) { return payment.currency==='USD' && payment.amount!=null && payment.amount!=='' && Number.isFinite(Number(payment.amount)) && fx && Number.isFinite(fx.rate) && fx.rate>0 ? Math.round(Number(payment.amount)*fx.rate) : null; }
  function monthlyAmount(p) { return p.amount==null||p.amount===''?null:Number(p.amount)/(p.billingCycle==='yearly'?12:1); }
  function monthlyKRW(p,fx) { const n=monthlyAmount(p);return n==null?null:n===0?0:p.currency==='USD'?(fx&&Number.isFinite(fx.rate)&&fx.rate>0?n*fx.rate:null):n; }
  function icon(status) {
    const paths=status==='paid'?'<path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="9"/>':status==='scheduled'?'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>':'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/>';
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  }
  function mount() {
    const $=id=>document.getElementById(id), container=$('subCardChoices');
    container.innerHTML=[['','미입력',''],...cards,['other','기타 카드','']].map(([id,name,asset])=>'<label class="sub-card-option"><input type="radio" name="subCardIssuer" value="'+id+'">'+(asset?'<img src="./assets/cards/'+asset+'" alt="" width="24" height="24">':'')+'<span>'+name+'</span></label>').join('');

  }
  window.SubscriptionDetails={cards,cardName,cardLabel,cycleLabel,validDate,estimate,monthlyAmount,monthlyKRW,icon,mount};
})();

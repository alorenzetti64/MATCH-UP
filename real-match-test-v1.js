// MATCH-UP · simulazione storica blind test 2025/26
(function(){
  const API='https://kwgfexwujbsrhqpwkrtt.supabase.co/functions/v1/historical-matchup';
  const ROT=['P1','P6','P5','P4','P3','P2'];
  let matches=[],analysis=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function pct(v){return Number.isFinite(v)?v.toFixed(1)+'%':'—'}
  function nextRot(r){return ROT[(ROT.indexOf(r)+1)%6]}
  function phaseOpp(p){return p==='serve'?'receive':'serve'}
  function fmtDate(v){try{return new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return v}}

  function ensurePanel(){
    const old=document.querySelector('#realMatchTest'); if(old)old.remove();
    const view=document.querySelector('#view-match'); if(!view)return;
    const panel=document.createElement('div');
    panel.className='panel'; panel.id='historicalMatchTest';
    panel.innerHTML=`
      <div class="section-head mini"><div><div class="eyebrow">TEST STORICO · 2025/26</div><h3>Facciamo finta che la partita non sia ancora stata giocata</h3></div></div>
      <p class="muted"><b>Obiettivo:</b> scegliere un match-up usando soltanto ciò che era disponibile prima della partita. Il risultato vero resta nascosto finché non lo chiedi.</p>
      <div class="form-grid two" style="margin-top:14px">
        <label>1 · Partita da simulare<select id="histMatchSelect"><option>Caricamento…</option></select></label>
        <label>2 · Loro partono in<select id="histOppStart">${ROT.map(r=>`<option>${r}</option>`).join('')}</select></label>
      </div>
      <div class="phase-row" style="margin-top:12px"><div class="side-label">3 · NOI INIZIAMO</div><div class="segmented small" id="histPhase"><button data-phase="receive" class="active">RICEZIONE</button><button data-phase="serve">BATTUTA</button></div></div>
      <button class="btn primary wide big" id="histAnalyze" style="margin-top:12px">ANALIZZA COME SE FOSSE IL GIORNO PRIMA</button>
      <div id="histBody" style="margin-top:16px"></div>`;
    view.appendChild(panel);
    const style=document.createElement('style'); style.textContent=`
      #historicalMatchTest .hist-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}
      #historicalMatchTest .hist-card{border:1px solid rgba(140,180,220,.25);border-radius:14px;padding:14px;background:rgba(7,19,34,.55)}
      #historicalMatchTest .hist-card.best{outline:2px solid rgba(210,220,50,.9)}
      #historicalMatchTest .hist-card h4{margin:0 0 8px;font-size:20px}
      #historicalMatchTest .hist-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:14px}
      #historicalMatchTest .hist-tip{margin-top:14px;padding:14px;border-radius:14px;background:rgba(180,200,30,.10);border:1px solid rgba(210,220,50,.35)}
      #historicalMatchTest table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px} #historicalMatchTest th,#historicalMatchTest td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:right} #historicalMatchTest th:first-child,#historicalMatchTest td:first-child{text-align:left}
    `; document.head.appendChild(style);
    document.querySelectorAll('#histPhase button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#histPhase button').forEach(x=>x.classList.toggle('active',x===b))});
    document.querySelector('#histAnalyze').onclick=run;
    loadMatches();
  }

  async function loadMatches(){
    const sel=document.querySelector('#histMatchSelect');
    try{
      const r=await fetch(`${API}?mode=matches`); if(!r.ok)throw new Error('HTTP '+r.status); const d=await r.json();
      matches=(d.matches||[]).filter(m=>new Date(m.scheduled_at)>=new Date('2025-11-13T00:00:00Z'));
      sel.innerHTML=matches.map(m=>`<option value="${m.id}" ${m.id==='4061a9fc-b06b-2576-35f6-70e6f882a0eb'?'selected':''}>${fmtDate(m.scheduled_at)} · ${esc(m.home_name)} – ${esc(m.away_name)}</option>`).join('');
    }catch(e){sel.innerHTML='<option>Impossibile caricare le partite</option>'}
  }

  function rowMap(arr){return Object.fromEntries((arr||[]).map(x=>[x.rotation,x]))}
  function calcCandidate(ourStart,oppStart,startPhase,our,opp){
    const om=rowMap(our.rotations), xm=rowMap(opp.rotations); let or=ourStart,xr=oppStart,p=startPhase,vals=[],soVals=[],brVals=[],samples=[];
    for(let i=0;i<12;i++){
      const a=om[or],b=xm[xr]; if(!a||!b)return null;
      if(p==='receive'){
        if(Number.isFinite(a.so_pct)&&Number.isFinite(b.break_pct)){vals.push(a.so_pct-b.break_pct);soVals.push(a.so_pct);samples.push(a.so_attempts,b.break_attempts)}
      }else{
        if(Number.isFinite(a.break_pct)&&Number.isFinite(b.so_pct)){vals.push(a.break_pct-b.so_pct);brVals.push(a.break_pct);samples.push(a.break_attempts,b.so_attempts)}
      }
      if(p==='receive')or=nextRot(or); else xr=nextRot(xr);
      p=phaseOpp(p);
    }
    if(!vals.length)return null;
    return {rotation:ourStart,value:vals.reduce((a,b)=>a+b,0)/vals.length,sideout:soVals.reduce((a,b)=>a+b,0)/(soVals.length||1),breakv:brVals.reduce((a,b)=>a+b,0)/(brVals.length||1),risk:Math.min(...vals),best:Math.max(...vals),minSample:Math.min(...samples)};
  }

  async function run(){
    const body=document.querySelector('#histBody'), matchId=document.querySelector('#histMatchSelect').value, oppStart=document.querySelector('#histOppStart').value;
    const phase=document.querySelector('#histPhase button.active')?.dataset.phase||'receive';
    body.innerHTML='<p class="muted">Sto ricostruendo solo ciò che si sapeva prima della partita…</p>';
    try{
      const r=await fetch(`${API}?mode=analyze&match_id=${encodeURIComponent(matchId)}`); if(!r.ok)throw new Error('HTTP '+r.status); analysis=await r.json();
      const candidates=ROT.map(rot=>calcCandidate(rot,oppStart,phase,analysis.our,analysis.opponent)).filter(Boolean);
      const best=candidates.reduce((a,b)=>b.value>a.value?b:a,candidates[0]);
      const cutoff=fmtDate(analysis.cutoff);
      const cards=candidates.map(c=>`<div class="hist-card ${c.rotation===best.rotation?'best':''}"><h4>${c.rotation}</h4><div class="hist-row"><span>VALORE</span><b>${c.value.toFixed(1)}</b></div><div class="hist-row"><span>SIDE OUT</span><b>${pct(c.sideout)}</b></div><div class="hist-row"><span>BREAK</span><b>${pct(c.breakv)}</b></div><div class="hist-row"><span>RISCHIO</span><b>${c.risk.toFixed(1)}</b></div><div class="hist-row"><span>MIGLIOR INCROCIO</span><b>${c.best.toFixed(1)}</b></div><div class="hist-row"><span>AFFIDABILITÀ</span><b>${c.minSample<8?'LOW':'OK'} · min ${c.minSample}</b></div></div>`).join('');
      body.innerHTML=`
        <div class="current-start"><b>STOP DATI:</b> prima del ${cutoff}. La partita scelta e tutte quelle successive sono escluse.</div>
        <div class="hist-tip"><b>DRITTA DEL MODELLO:</b> con loro ${esc(oppStart)} e noi in ${phase==='receive'?'RICEZIONE':'BATTUTA'}, tra le sei partenze il valore più alto è <b>${best.rotation}</b>. Non è il risultato della partita: è il consiglio prodotto usando soltanto lo storico precedente.</div>
        <div class="hist-grid">${cards}</div>
        <details style="margin-top:16px"><summary><b>Vedi i dati P1–P6 usati per il calcolo</b></summary>${rotationTable(analysis)}</details>
        <button class="btn wide" id="histReveal" style="margin-top:16px">MOSTRA COSA È SUCCESSO DAVVERO</button><div id="histRevealBody"></div>`;
      document.querySelector('#histReveal').onclick=()=>{document.querySelector('#histRevealBody').innerHTML=`<div class="current-start" style="margin-top:10px"><b>RISULTATO REALE:</b> ${esc(analysis.target.home_name)} ${analysis.target.home_sets}-${analysis.target.away_sets} ${esc(analysis.target.away_name)}</div>`};
    }catch(e){console.error(e);body.innerHTML='<p class="muted">Il test storico non è disponibile in questo momento.</p>'}
  }

  function rotationTable(d){
    const a=rowMap(d.our.rotations),b=rowMap(d.opponent.rotations);
    return `<table><thead><tr><th>Rot.</th><th>${esc(d.our.name)} SO</th><th>${esc(d.our.name)} BP</th><th>${esc(d.opponent.name)} SO</th><th>${esc(d.opponent.name)} BP</th></tr></thead><tbody>${ROT.map(r=>`<tr><td>${r}</td><td>${pct(a[r].so_pct)} (${a[r].so_wins}/${a[r].so_attempts})</td><td>${pct(a[r].break_pct)} (${a[r].break_wins}/${a[r].break_attempts})</td><td>${pct(b[r].so_pct)} (${b[r].so_wins}/${b[r].so_attempts})</td><td>${pct(b[r].break_pct)} (${b[r].break_wins}/${b[r].break_attempts})</td></tr>`).join('')}</tbody></table>`;
  }

  ensurePanel();
})();
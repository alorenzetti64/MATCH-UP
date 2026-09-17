// MATCH-UP · sintesi semplice + proiezione grezza del set
(function(){
  const ENGINE='https://kwgfexwujbsrhqpwkrtt.supabase.co/functions/v1/matchup-engine';
  const ROTS=['P1','P6','P5','P4','P3','P2'];
  let cache=null,cacheKey='';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function t(id){return state.teams.find(x=>x.id===id)}
  function s(id){return state.seasons.find(x=>x.id===id)}
  function numbers(team,lineup){const out={};for(const slot of ['P','S1','C2','O','S2','C1','L']){const p=team?.roster?.find(x=>x.id===lineup?.[slot]);out[slot]=p?.number||''}return out}
  function complete(team,lineup){const n=numbers(team,lineup);return ['P','S1','C2','O','S2','C1'].every(k=>n[k]!=='')}
  async function engine(){
    const us=t(state.match.ourTeamId),them=t(state.match.oppTeamId);
    if(!us||!them)throw new Error('Scegli prima entrambe le squadre.');
    if(!complete(us,state.match.ourLineup)||!complete(them,state.match.oppLineup))throw new Error('Completa prima i due sestetti.');
    if(!String(s(state.match.seasonId)?.name||'').includes('2025'))throw new Error('Per questo test seleziona 2025/26.');
    const payload={our_team:us.name,opp_team:them.name,our_lineup:numbers(us,state.match.ourLineup),opp_lineup:numbers(them,state.match.oppLineup)};
    const key=JSON.stringify(payload);if(cache&&key===cacheKey)return cache;
    const r=await fetch(ENGINE,{method:'POST',headers:{'Content-Type':'application/json'},body:key});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error('Il motore statistico non risponde in questo momento.');
    cache=d;cacheKey=key;return d;
  }
  function mapRot(a){return Object.fromEntries((a||[]).map(x=>[x.rotation,x]))}
  function pct(v){return v==null?'—':v.toFixed(1)+'%'}
  function edgeToP(phase,our,opp){
    if(phase==='serve'){
      if(our?.break_pct==null||opp?.so_pct==null)return null;
      return Math.max(0,Math.min(1,((our.break_pct+(100-opp.so_pct))/2)/100));
    }
    if(our?.so_pct==null||opp?.break_pct==null)return null;
    return Math.max(0,Math.min(1,((our.so_pct+(100-opp.break_pct))/2)/100));
  }
  function projection(p){
    if(p==null)return '—';
    if(Math.abs(p-.5)<.012)return 'SET DA VANTAGGI';
    if(p>.5){let l=Math.round(25*(1-p)/p);l=Math.max(10,Math.min(23,l));return `25-${l}`}
    let l=Math.round(25*p/(1-p));l=Math.max(10,Math.min(23,l));return `${l}-25`;
  }
  function labelPhase(p){return p==='serve'?'BATTUTA':'RICEZIONE'}

  async function conciseBest(phase){
    const box=document.querySelector('#bestAnswer');if(!box)return;
    box.innerHTML='<span>RISPOSTA</span><strong>Calcolo…</strong>';
    try{
      const d=await engine();
      const rows=ROTS.map(or=>{
        const a=(d.all?.[phase]||[]).filter(x=>x.opp_rotation===or&&x.value!=null).sort((x,y)=>y.value-x.value);
        return a[0]||{opp_rotation:or,our_rotation:'—',value:null};
      });
      box.innerHTML=`<span>LETTURA SEMPLICE</span><strong style="font-size:1.15rem">Se loro partono così, noi partiremo così</strong><div style="display:grid;gap:8px;margin-top:12px">${rows.map(r=>`<div class="current-start" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><b>LORO ${r.opp_rotation}</b><span style="font-size:1.05rem">→ NOI <b>${r.our_rotation}</b></span></div>`).join('')}</div><details style="margin-top:10px"><summary>Vedi indice statistico</summary><div style="display:grid;gap:6px;margin-top:8px">${rows.map(r=>`<small>Loro ${r.opp_rotation} → Noi ${r.our_rotation}: indice ${r.value==null?'—':(r.value>=0?'+':'')+r.value.toFixed(1)}</small>`).join('')}</div></details>`;
    }catch(err){box.innerHTML=`<span>RISPOSTA</span><strong>${esc(err.message)}</strong>`}
  }

  async function conciseCycle(){
    const q=state.match.simple,root=document.querySelector('#smCycleAnswer');if(!root)return;
    root.innerHTML='<p class="muted">Calcolo…</p>';
    try{
      const d=await engine(),om=mapRot(d.our_team.rotations),tm=mapRot(d.opp_team.rotations);
      const cyc=cycle(q.askOurPhase,q.askOurRotation,q.askOppRotation);
      const rows=cyc.map(x=>{
        const o=om[x.ourRotation],p=tm[x.oppRotation],win=edgeToP(x.ourPhase,o,p);
        let detail='';
        if(x.ourPhase==='serve')detail=`BP noi ${pct(o?.break_pct)} · SO loro ${pct(p?.so_pct)}`;
        else detail=`SO noi ${pct(o?.so_pct)} · BP loro ${pct(p?.break_pct)}`;
        return {...x,win,detail};
      });
      const valid=rows.filter(x=>x.win!=null),avg=valid.length?valid.reduce((a,x)=>a+x.win,0)/valid.length:null;
      const pos=valid.filter(x=>x.win>.5).length;
      const sorted=[...valid].sort((a,b)=>b.win-a.win),best=sorted[0],worst=sorted[sorted.length-1];
      const score=projection(avg);
      const reading=avg==null?'Dati insufficienti':Math.abs(avg-.5)<.012?'Equilibrio quasi totale':avg>.5?'Incrocio complessivamente favorevole':'Incrocio complessivamente sfavorevole';
      root.innerHTML=`
        <div class="answer-card" style="margin-bottom:12px">
          <span>LETTURA RAPIDA</span>
          <strong style="font-size:1.35rem">${reading}</strong>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px">
            <div class="current-start"><b>PROIEZIONE SET</b><br><span style="font-size:1.35rem;font-weight:800">${score}</span></div>
            <div class="current-start"><b>INCROCI A FAVORE</b><br><span style="font-size:1.35rem;font-weight:800">${pos}/${valid.length||12}</span></div>
            <div class="current-start"><b>INDICE MEDIO</b><br><span style="font-size:1.35rem;font-weight:800">${avg==null?'—':(avg*100).toFixed(1)+'%'}</span></div>
          </div>
          ${best?`<p style="margin:12px 0 0"><b>Momento migliore:</b> NOI ${best.ourRotation} ${labelPhase(best.ourPhase)} contro LORO ${best.oppRotation}.</p>`:''}
          ${worst?`<p style="margin:5px 0 0"><b>Momento più delicato:</b> NOI ${worst.ourRotation} ${labelPhase(worst.ourPhase)} contro LORO ${worst.oppRotation}.</p>`:''}
          <small style="display:block;margin-top:10px">La proiezione del set è volutamente “a spanne”: traduce i 12 incroci in un punteggio indicativo. Non è una previsione del risultato.</small>
        </div>
        <details><summary><b>Vedi le 12 situazioni nel dettaglio</b></summary><div class="cycle-list" style="margin-top:10px">${rows.map(x=>`<div class="cycle-row-rich"><div class="cycle-top"><div class="cycle-num">${x.n}</div><div class="state-chip ${x.ourPhase}">NOI ${labelPhase(x.ourPhase)} ${x.ourRotation}</div><div class="arrow">↔</div><div class="state-chip ${x.oppPhase}">LORO ${labelPhase(x.oppPhase)} ${x.oppRotation}</div></div><div class="cycle-detail"><div><b>LETTURA</b><span>${x.detail}</span></div><div><b>INDICE PUNTO</b><span>${x.win==null?'—':(x.win*100).toFixed(1)+'%'}</span></div></div></div>`).join('')}</div></details>`;
    }catch(err){root.innerHTML=`<p class="muted">${esc(err.message)}</p>`}
  }

  document.addEventListener('click',function(ev){
    const b=ev.target.closest('button');if(!b)return;
    if(b.id==='bestServe'||b.id==='bestReceive'){
      ev.preventDefault();ev.stopImmediatePropagation();conciseBest(b.id==='bestServe'?'serve':'receive');
    }
    if(b.id==='smShowCycle'){
      ev.preventDefault();ev.stopImmediatePropagation();conciseCycle();
    }
  },true);
})();

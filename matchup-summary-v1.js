// MATCH-UP · sintesi operativa: migliore/peggiore + tipo battuta + proiezione set
(function(){
  const ENGINE='https://kwgfexwujbsrhqpwkrtt.supabase.co/functions/v1/matchup-engine';
  let cache=null,cacheKey='';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function team(id){return state.teams.find(x=>x.id===id)}
  function season(id){return state.seasons.find(x=>x.id===id)}
  function numbers(t,lineup){const out={};for(const slot of ['P','S1','C2','O','S2','C1','L']){const p=t?.roster?.find(x=>x.id===lineup?.[slot]);out[slot]=p?.number||''}return out}
  function complete(t,lineup){const n=numbers(t,lineup);return ['P','S1','C2','O','S2','C1'].every(k=>n[k]!=='')}
  function playerByNumber(t,n){const s=String(n??'').replace(/^0+/,'');return t?.roster?.find(p=>String(p.number??'').replace(/^0+/,'')===s)}
  function playerName(t,n){const p=playerByNumber(t,n);return p?`${p.number?'#'+p.number+' ':''}${p.name}`:`#${String(n).replace(/^0+/,'')}`}

  function mixStore(){
    state.match=state.match||{};
    if(state.match.serveMixUiVersion!==2){
      state.match.serveMix={};
      state.match.serveMixUiVersion=2;
      try{save()}catch(_){ }
    }
    state.match.serveMix=state.match.serveMix||{};
    return state.match.serveMix;
  }

  function ensureMixModal(){
    if(document.querySelector('#serveMixModal'))return;
    const wrap=document.createElement('div');
    wrap.id='serveMixModal';
    wrap.className='serve-mix-modal hidden';
    wrap.innerHTML=`<div class="serve-mix-backdrop" data-mix-cancel></div>
      <div class="serve-mix-card" role="dialog" aria-modal="true" aria-labelledby="serveMixTitle">
        <div class="serve-mix-kicker">TIPO DI BATTUTA</div>
        <h3 id="serveMixTitle">Battuta alternata</h3>
        <p id="serveMixText" class="serve-mix-text"></p>
        <div class="serve-mix-split">
          <div class="serve-mix-box"><span id="serveMixSpinValue">50%</span><small>SPIN</small></div>
          <div class="serve-mix-box"><span id="serveMixFloatValue">50%</span><small>FLOAT</small></div>
        </div>
        <input id="serveMixRange" class="serve-mix-range" type="range" min="0" max="100" step="1" value="50">
        <div class="serve-mix-scale"><span>Più FLOAT</span><span>Più SPIN</span></div>
        <div class="serve-mix-actions"><button type="button" class="btn" data-mix-cancel>Annulla</button><button type="button" class="btn primary" id="serveMixConfirm">CONFERMA</button></div>
      </div>`;
    document.body.appendChild(wrap);
    const style=document.createElement('style');
    style.textContent=`
      .serve-mix-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px}
      .serve-mix-modal.hidden{display:none}
      .serve-mix-backdrop{position:absolute;inset:0;background:rgba(1,7,15,.78);backdrop-filter:blur(8px)}
      .serve-mix-card{position:relative;width:min(520px,100%);background:#0b1a29;border:1px solid #31506b;border-radius:22px;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.55)}
      .serve-mix-kicker{font-size:.74rem;font-weight:900;letter-spacing:.13em;color:#8fbce8}
      .serve-mix-card h3{font-size:1.5rem;margin:6px 0 8px}
      .serve-mix-text{color:#c7d7e7;margin:0 0 18px;line-height:1.5}
      .serve-mix-split{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 16px}
      .serve-mix-box{background:#102537;border:1px solid #294962;border-radius:16px;padding:14px;text-align:center}
      .serve-mix-box span{display:block;font-size:2rem;font-weight:900;line-height:1;color:#fff}
      .serve-mix-box small{display:block;margin-top:5px;font-weight:900;letter-spacing:.08em;color:#9eb7cc}
      .serve-mix-range{width:100%;accent-color:#b8d61f;cursor:pointer}
      .serve-mix-scale{display:flex;justify-content:space-between;margin-top:7px;color:#819bb1;font-size:.8rem;font-weight:800}
      .serve-mix-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:22px;flex-wrap:wrap}
      @media(max-width:560px){.serve-mix-card{padding:18px;border-radius:18px}.serve-mix-actions .btn{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function askMixedModal(name,def){
    ensureMixModal();
    return new Promise(resolve=>{
      const modal=document.querySelector('#serveMixModal');
      const text=modal.querySelector('#serveMixText');
      const range=modal.querySelector('#serveMixRange');
      const spin=modal.querySelector('#serveMixSpinValue');
      const flt=modal.querySelector('#serveMixFloatValue');
      const confirm=modal.querySelector('#serveMixConfirm');
      text.innerHTML=`<b>${esc(name)}</b> alterna SPIN e FLOAT.<br>Scegli la percentuale che vuoi considerare per questo match-up.`;
      range.value=String(def);
      const update=()=>{const v=Number(range.value);spin.textContent=`${v}%`;flt.textContent=`${100-v}%`};
      update();
      modal.classList.remove('hidden');
      range.addEventListener('input',update);
      const cleanup=(result)=>{
        range.removeEventListener('input',update);
        modal.querySelectorAll('[data-mix-cancel]').forEach(x=>x.removeEventListener('click',cancel));
        confirm.removeEventListener('click',ok);
        modal.classList.add('hidden');
        resolve(result);
      };
      const cancel=()=>cleanup(null);
      const ok=()=>cleanup(Number(range.value));
      modal.querySelectorAll('[data-mix-cancel]').forEach(x=>x.addEventListener('click',cancel));
      confirm.addEventListener('click',ok);
    });
  }

  async function callEngine(){
    const us=team(state.match.ourTeamId),them=team(state.match.oppTeamId);
    if(!us||!them)throw new Error('Scegli prima entrambe le squadre.');
    if(!complete(us,state.match.ourLineup)||!complete(them,state.match.oppLineup))throw new Error('Completa prima i due sestetti.');
    if(!String(season(state.match.seasonId)?.name||'').includes('2025'))throw new Error('Per questo test seleziona 2025/26.');
    const payload={our_team:us.name,opp_team:them.name,our_lineup:numbers(us,state.match.ourLineup),opp_lineup:numbers(them,state.match.oppLineup),serve_mix:mixStore()};
    const key=JSON.stringify(payload);if(cache&&cacheKey===key)return cache;
    const r=await fetch(ENGINE,{method:'POST',headers:{'Content-Type':'application/json'},body:key});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error('Il motore statistico non risponde in questo momento.');
    cache=d;cacheKey=key;return d;
  }

  async function askMixedIfNeeded(d){
    const store=mixStore();let changed=false;
    const sides=[['our',d.our_team,team(state.match.ourTeamId)],['opp',d.opp_team,team(state.match.oppTeamId)]];
    for(const [side,apiTeam,localTeam] of sides){
      const profs=d.serve_profiles?.[side]||{};
      for(const p of Object.values(profs)){
        if(p.classification!=='mixed')continue;
        const key=`${apiTeam.id}:${p.number}`;if(store[key]!=null)continue;
        const def=Math.round(p.spin_pct||50),name=playerName(localTeam,p.number);
        const v=await askMixedModal(name,def);
        if(v===null)continue;
        if(Number.isFinite(v)){store[key]=Math.max(0,Math.min(100,v));changed=true;}
      }
    }
    if(changed){save();cache=null;cacheKey='';return await callEngine();}
    return d;
  }

  function styleText(st){
    const p=st?.server_profile;if(!p)return 'tipo di battuta non disponibile';
    if(p.classification==='spin')return 'SPIN';
    if(p.classification==='float')return 'FLOAT';
    if(p.classification==='mixed')return `${Math.round((st.receiver_detail?.spin_weight??.5)*100)}% SPIN · ${100-Math.round((st.receiver_detail?.spin_weight??.5)*100)}% FLOAT`;
    return 'tipo di battuta non disponibile';
  }

  function note(pair,d){
    const st=pair?.states?.[0];if(!st)return 'Dati insufficienti per spiegare questo incrocio.';
    const serverTeam=st.server_side==='our'?team(state.match.ourTeamId):team(state.match.oppTeamId);
    const receivingName=st.server_side==='our'?d.opp_team.name:d.our_team.name;
    const srv=playerName(serverTeam,st.server_number),kind=styleText(st);
    const so=st.receiver_so==null?'—':st.receiver_so.toFixed(1)+'%';
    const fav=pair.favorable_states??0,used=pair.states_used??12;
    const weighted=st.fallback_used?'Il dato specifico per tipo di battuta è scarso, quindi il modello integra il dato generale di rotazione.':'Il Side Out di ricezione è costruito sui singoli ricevitori, pesati per quante battute hanno realmente ricevuto contro quel tipo di servizio.';
    return `Parte al servizio ${srv}, con ${kind}. In questa rotazione ${receivingName} produce un Side Out stimato del ${so}. ${weighted} Nello sviluppo del set risultano favorevoli ${fav} situazioni su ${used}.`;
  }

  function card(title,pair,phase,d,kind){
    if(!pair)return '';
    const line=phase==='serve'
      ?`NOI dobbiamo battere in <b>${pair.our_rotation}</b> · LORO ricevere in <b>${pair.opp_rotation}</b>`
      :`NOI dobbiamo ricevere in <b>${pair.our_rotation}</b> · LORO battere in <b>${pair.opp_rotation}</b>`;
    return `<div class="current-start" style="padding:16px;margin-top:12px;border:${kind==='best'?'1px solid #789904':'1px solid #7b3d45'}">
      <div class="eyebrow">${title}</div>
      <div style="font-size:1.25rem;font-weight:800;margin-top:5px">${line}</div>
      <div style="margin-top:10px"><b>PROIEZIONE SET:</b> <span style="font-size:1.25rem;font-weight:800">${esc(pair.projected_score||'—')}</span></div>
      <p style="margin:10px 0 0"><b>Nota AI:</b> ${esc(note(pair,d))}</p>
    </div>`;
  }

  async function conciseBest(phase){
    const box=document.querySelector('#bestAnswer');if(!box)return;
    box.innerHTML='<span>RISPOSTA</span><strong>Calcolo sui dati 2025/26…</strong>';
    try{
      let d=await callEngine();d=await askMixedIfNeeded(d);
      const best=d.best?.[phase],worst=d.worst?.[phase];
      box.innerHTML=`<span>${phase==='serve'?'PARTENZA IN BATTUTA':'PARTENZA IN RICEZIONE'}</span>
        ${card('MIGLIOR MATCH-UP',best,phase,d,'best')}
        ${card('PEGGIOR MATCH-UP',worst,phase,d,'worst')}
        <small style="display:block;margin-top:12px">La proiezione del set è indicativa: usa i 12 passaggi del match-up e i rendimenti storici 2025/26. Non è una previsione certa del punteggio.</small>`;
    }catch(err){box.innerHTML=`<span>RISPOSTA</span><strong>${esc(err.message)}</strong>`}
  }

  async function conciseCycle(){
    const q=state.match.simple,root=document.querySelector('#smCycleAnswer');if(!root)return;
    root.innerHTML='<p class="muted">Calcolo…</p>';
    try{
      let d=await callEngine();d=await askMixedIfNeeded(d);
      const pair=(d.all?.[q.askOurPhase]||[]).find(x=>x.our_rotation===q.askOurRotation&&x.opp_rotation===q.askOppRotation);
      if(!pair)throw new Error('Non trovo questo incrocio.');
      const line=q.askOurPhase==='serve'
        ?`NOI battiamo in ${pair.our_rotation} · LORO ricevono in ${pair.opp_rotation}`
        :`NOI riceviamo in ${pair.our_rotation} · LORO battono in ${pair.opp_rotation}`;
      root.innerHTML=`<div class="answer-card"><span>SE PARTIAMO COSÌ</span><strong style="font-size:1.25rem">${line}</strong><div style="margin-top:10px"><b>PROIEZIONE SET:</b> <span style="font-size:1.3rem;font-weight:800">${esc(pair.projected_score||'—')}</span></div><p style="margin:10px 0 0"><b>Nota AI:</b> ${esc(note(pair,d))}</p></div><div id="matchupGraphicRoot"></div>`;
      if(window.renderMatchupGraphic)window.renderMatchupGraphic(root.querySelector('#matchupGraphicRoot'),pair);
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

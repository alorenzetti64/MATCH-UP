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
  function mixStore(){state.match=state.match||{};state.match.serveMix=state.match.serveMix||{};return state.match.serveMix}

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
        const raw=prompt(`${name} alterna SPIN e FLOAT.\nChe percentuale di battute SPIN vuoi considerare?\n\nInserisci un numero da 0 a 100.`,String(def));
        if(raw===null)continue;
        const v=Math.max(0,Math.min(100,Number(String(raw).replace(',','.'))));
        if(Number.isFinite(v)){store[key]=v;changed=true;}
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
      root.innerHTML=`<div class="answer-card"><span>SE PARTIAMO COSÌ</span><strong style="font-size:1.25rem">${line}</strong><div style="margin-top:10px"><b>PROIEZIONE SET:</b> <span style="font-size:1.3rem;font-weight:800">${esc(pair.projected_score||'—')}</span></div><p style="margin:10px 0 0"><b>Nota AI:</b> ${esc(note(pair,d))}</p></div>`;
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

// MATCH-UP · interfaccia operativa semplice per una nuova partita
(function(){
  const ROTS=['P1','P6','P5','P4','P3','P2'];

  function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function phaseLabel(p){return p==='serve'?'BATTUTA':'RICEZIONE'}
  function opposite(p){return p==='serve'?'receive':'serve'}
  function teamById(id){return state.teams.find(t=>t.id===id)}
  function seasonById(id){return state.seasons.find(s=>s.id===id)}
  function compById(id){return state.competitions.find(c=>c.id===id)}
  function playerLabel2(t,id){const p=t?.roster?.find(x=>x.id===id);return p?`${p.number?'#'+p.number+' ':''}${p.name}`:'—'}

  function ensureMatchLineups(){
    state.match=state.match||{};
    state.match.ourLineup=state.match.ourLineup||Object.fromEntries(SLOTS.map(s=>[s,'']));
    state.match.oppLineup=state.match.oppLineup||Object.fromEntries(SLOTS.map(s=>[s,'']));
    state.match.simple=state.match.simple||{
      askOurPhase:'serve',askOurRotation:'P1',askOppRotation:'P1',
      invOppPhase:'serve',invOppStartRotation:'P1',invDesiredOurPhase:'receive',invDesiredOurRotation:'P1',invDesiredOppRotation:'P1'
    };
  }

  function options(items,value,labelFn){return '<option value="">—</option>'+items.map(x=>`<option value="${e(x.id)}" ${x.id===value?'selected':''}>${e(labelFn(x))}</option>`).join('')}
  function rotOptions(value){return ROTS.map(r=>`<option value="${r}" ${r===value?'selected':''}>${r}</option>`).join('')}

  function lineupBlock(side,t,lineup){
    const name=side==='our'?'NOI':'LORO';
    return `<div class="panel" style="padding:14px"><div class="eyebrow">SESTETTO PARTITA · ${name}</div><h3 style="margin-top:4px">${e(t?.name||'Seleziona squadra')}</h3><div class="lineup-editor">${SLOTS.map(slot=>{
      const role=SLOT_ROLE[slot];
      const ps=(t?.roster||[]).filter(p=>p.role===role);
      return `<label class="lineup-slot"><b>${slot}</b><select data-lineup-side="${side}" data-lineup-slot="${slot}"><option value="">—</option>${ps.map(p=>`<option value="${p.id}" ${lineup?.[slot]===p.id?'selected':''}>${e(playerLabel2(t,p.id))}</option>`).join('')}</select></label>`
    }).join('')}</div></div>`;
  }

  function renderSimpleMatch(){
    ensureMatchLineups();
    const root=document.querySelector('#view-match'); if(!root)return;
    const sid=state.match.seasonId||'';
    const cid=state.match.competitionId||'';
    const comps=state.competitions.filter(c=>!sid||c.seasonId===sid);
    const teams=state.teams.filter(t=>(!sid||t.seasonId===sid)&&(!cid||t.competitionId===cid));
    const us=teamById(state.match.ourTeamId), them=teamById(state.match.oppTeamId), q=state.match.simple;

    root.innerHTML=`
      <div class="section-head"><div><div class="eyebrow">NUOVA PARTITA</div><h2>Imposta e chiedi</h2></div></div>
      <div class="panel">
        <div class="form-grid two"><label>Stagione<select id="smSeason">${options(state.seasons,sid,s=>s.name)}</select></label><label>Competizione<select id="smComp">${options(comps,cid,c=>c.name)}</select></label></div>
        <div class="form-grid two"><label>NOI<select id="smUs">${options(teams,state.match.ourTeamId,t=>t.name)}</select></label><label>LORO<select id="smThem">${options(teams,state.match.oppTeamId,t=>t.name)}</select></label></div>
      </div>
      <div class="lineup-pair">${lineupBlock('our',us,state.match.ourLineup)}${lineupBlock('opp',them,state.match.oppLineup)}</div>

      <div class="panel" style="margin-top:14px">
        <div class="eyebrow">1 · MIGLIOR MATCH-UP</div><h3>Quando battiamo / quando riceviamo</h3>
        <p class="muted">Qui entrerà il motore statistico sui dati 2025/26. Non mostriamo classifiche finché il calcolo per rotazione e sestetto non è affidabile.</p>
        <div class="form-grid two"><button class="btn wide" id="bestServe">MIGLIOR MATCH-UP · BATTUTA</button><button class="btn wide" id="bestReceive">MIGLIOR MATCH-UP · RICEZIONE</button></div>
        <div id="bestAnswer" class="answer-card" style="margin-top:10px"><span>RISPOSTA</span><strong>Motore dati in preparazione</strong></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="eyebrow">2 · SE PARTIAMO COSÌ</div><h3>Cosa succede?</h3>
        <div class="form-grid two"><label>NOI · fase<select id="smAskPhase"><option value="serve" ${q.askOurPhase==='serve'?'selected':''}>BATTUTA</option><option value="receive" ${q.askOurPhase==='receive'?'selected':''}>RICEZIONE</option></select></label><label>NOI · rotazione<select id="smAskOurRot">${rotOptions(q.askOurRotation)}</select></label></div>
        <div class="form-grid two"><label>LORO · fase<input value="${phaseLabel(opposite(q.askOurPhase))}" disabled></label><label>LORO · rotazione<select id="smAskOppRot">${rotOptions(q.askOppRotation)}</select></label></div>
        <button class="btn primary wide" id="smShowCycle">MOSTRA COSA SUCCEDE</button>
        <div id="smCycleAnswer" style="margin-top:12px"></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="eyebrow">3 · COME DEVO PARTIRE?</div><h3>Loro partono così. Io voglio ottenere questo incrocio.</h3>
        <div class="form-grid two"><label>LORO partono in<select id="smInvOppPhase"><option value="serve" ${q.invOppPhase==='serve'?'selected':''}>BATTUTA</option><option value="receive" ${q.invOppPhase==='receive'?'selected':''}>RICEZIONE</option></select></label><label>LORO · rotazione iniziale<select id="smInvOppStartRot">${rotOptions(q.invOppStartRotation)}</select></label></div>
        <hr>
        <div class="form-grid two"><label>Voglio NOI in<select id="smInvOurPhase"><option value="serve" ${q.invDesiredOurPhase==='serve'?'selected':''}>BATTUTA</option><option value="receive" ${q.invDesiredOurPhase==='receive'?'selected':''}>RICEZIONE</option></select></label><label>NOI · rotazione desiderata<select id="smInvOurRot">${rotOptions(q.invDesiredOurRotation)}</select></label></div>
        <div class="form-grid two"><label>LORO saranno in<input id="smInvOppPhaseLabel" value="${phaseLabel(opposite(q.invDesiredOurPhase))}" disabled></label><label>LORO · rotazione desiderata<select id="smInvOppRot">${rotOptions(q.invDesiredOppRotation)}</select></label></div>
        <button class="btn primary wide" id="smSolve">DIMMI COME DEVO PARTIRE</button>
        <div id="smInverseAnswer" class="answer-card" style="margin-top:10px"><span>RISPOSTA</span><strong>—</strong></div>
      </div>`;

    smSeason.onchange=()=>{state.match.seasonId=smSeason.value;state.match.competitionId='';state.match.ourTeamId=null;state.match.oppTeamId=null;save();renderSimpleMatch()};
    smComp.onchange=()=>{state.match.competitionId=smComp.value;state.match.ourTeamId=null;state.match.oppTeamId=null;save();renderSimpleMatch()};
    smUs.onchange=()=>{state.match.ourTeamId=smUs.value||null;state.match.ourLineup=Object.fromEntries(SLOTS.map(s=>[s,'']));save();renderSimpleMatch()};
    smThem.onchange=()=>{state.match.oppTeamId=smThem.value||null;state.match.oppLineup=Object.fromEntries(SLOTS.map(s=>[s,'']));save();renderSimpleMatch()};
    root.querySelectorAll('[data-lineup-side]').forEach(sel=>sel.onchange=()=>{
      const side=sel.dataset.lineupSide,slot=sel.dataset.lineupSlot,key=side==='our'?'ourLineup':'oppLineup';
      const id=sel.value;
      if(id)SLOTS.forEach(s=>{if(s!==slot&&state.match[key][s]===id)state.match[key][s]=''});
      state.match[key][slot]=id;save();renderSimpleMatch();
    });

    bestServe.onclick=()=>{bestAnswer.querySelector('strong').textContent='Sto preparando il calcolo reale per sestetto e rotazioni. Qui non useremo medie generiche.'};
    bestReceive.onclick=()=>{bestAnswer.querySelector('strong').textContent='Sto preparando il calcolo reale per sestetto e rotazioni. Qui non useremo medie generiche.'};

    smAskPhase.onchange=()=>{q.askOurPhase=smAskPhase.value;save();renderSimpleMatch()};
    smAskOurRot.onchange=()=>{q.askOurRotation=smAskOurRot.value;save()};
    smAskOppRot.onchange=()=>{q.askOppRotation=smAskOppRot.value;save()};
    smShowCycle.onclick=()=>{
      const cyc=cycle(q.askOurPhase,q.askOurRotation,q.askOppRotation);
      smCycleAnswer.innerHTML=`<div class="cycle-list">${cyc.map(x=>`<div class="cycle-row-rich"><div class="cycle-top"><div class="cycle-num">${x.n}</div><div class="state-chip ${x.ourPhase}">NOI ${phaseLabel(x.ourPhase)} ${x.ourRotation}</div><div class="arrow">↔</div><div class="state-chip ${x.oppPhase}">LORO ${phaseLabel(x.oppPhase)} ${x.oppRotation}</div></div></div>`).join('')}</div>`;
    };

    smInvOppPhase.onchange=()=>{q.invOppPhase=smInvOppPhase.value;save()};
    smInvOppStartRot.onchange=()=>{q.invOppStartRotation=smInvOppStartRot.value;save()};
    smInvOurPhase.onchange=()=>{q.invDesiredOurPhase=smInvOurPhase.value;save();renderSimpleMatch()};
    smInvOurRot.onchange=()=>{q.invDesiredOurRotation=smInvOurRot.value;save()};
    smInvOppRot.onchange=()=>{q.invDesiredOppRotation=smInvOppRot.value;save()};
    smSolve.onclick=()=>{
      const query={oppStartPhase:q.invOppPhase,oppStartRotation:q.invOppStartRotation,desiredOurPhase:q.invDesiredOurPhase,desiredOurRotation:q.invDesiredOurRotation,desiredOppRotation:q.invDesiredOppRotation};
      const r=solveInverse(query);
      smInverseAnswer.querySelector('strong').textContent=r?`NOI dobbiamo partire in ${phaseLabel(r.ourStartPhase)} ${r.ourStartRotation}`:'Nessuna combinazione trovata';
    };
  }

  renderMatch=renderSimpleMatch;
  const oldSwitch=switchView;
  switchView=function(n){oldSwitch(n);if(n==='match')renderSimpleMatch()};
  renderSimpleMatch();
})();

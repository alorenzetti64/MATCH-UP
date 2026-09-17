// MATCH-UP v4: sestetto partita + gestione libero + contesto indici
(function(){
  const emptyLineup=()=>Object.fromEntries(SLOTS.map(s=>[s,'']));
  if(!state.match.ourLineup) state.match.ourLineup=emptyLineup();
  if(!state.match.oppLineup) state.match.oppLineup=emptyLineup();

  function lineupFor(side){return side==='our'?state.match.ourLineup:state.match.oppLineup}
  function resetLineup(side){state.match[side==='our'?'ourLineup':'oppLineup']=emptyLineup()}

  function physicalForMatch(t,r,lu){
    const shift=ROTATIONS.indexOf(r),out={};
    for(const [z0,slot] of Object.entries(BASE_P1)){
      let z=+z0;
      for(let i=0;i<shift;i++) z=z===1?6:z-1;
      const playerId=lu?.[slot]||'';
      out[z]={slot,playerId,player:player(t,playerId),replacedByLibero:false};
    }
    return out;
  }

  function effectiveCourt(t,r,phase,lu){
    if(!t)return null;
    const pos=physicalForMatch(t,r,lu);
    const liberoId=lu?.L||'';
    const libero=player(t,liberoId);
    for(const z of [5,6,1]){
      const cell=pos[z];
      if(!cell||!['C1','C2'].includes(cell.slot)) continue;
      const centralServes=phase==='serve'&&z===1;
      if(!centralServes&&libero){
        pos[z]={slot:'L',playerId:liberoId,player:libero,replacedByLibero:true,replaces:cell.slot,replacedPlayerId:cell.playerId};
      }
    }
    return {pos,front:[4,3,2].map(z=>pos[z]),back:[5,6,1].map(z=>pos[z]),server:pos[1]};
  }

  function lineupEditor(t,side){
    if(!t)return '<div class="muted">Seleziona prima la squadra.</div>';
    const lu=lineupFor(side);
    return `<div class="match-lineup-editor">${SLOTS.map(slot=>{
      const opts=t.roster.filter(p=>p.role===SLOT_ROLE[slot]).map(p=>`<option value="${p.id}" ${lu[slot]===p.id?'selected':''}>${esc(playerLabel(t,p.id))}</option>`).join('');
      return `<label><span>${slot} · ${SLOT_ROLE[slot]}</span><select data-match-side="${side}" data-match-slot="${slot}"><option value="">— scegli —</option>${opts}</select></label>`;
    }).join('')}</div>`;
  }

  function courtHtml(t,r,phase,lu){
    if(!t)return '<div class="muted">Nessuna squadra selezionata.</div>';
    const c=effectiveCourt(t,r,phase,lu);
    return `<div class="mini-court-head">${r} · alzatore in zona ${r.slice(1)} · ${PHASE[phase]}</div><div class="mini-court-grid">${[4,3,2,5,6,1].map(z=>{
      const x=c.pos[z];
      const note=x.replacedByLibero?` <small>↳ per ${x.replaces}</small>`:'';
      return `<div><b>Z${z} · ${x.slot}${note}</b><span>${esc(playerLabel(t,x.playerId))}</span></div>`;
    }).join('')}</div>`;
  }

  function activePlayersHtml(t,r,phase,lu){
    if(!t)return'';
    const c=effectiveCourt(t,r,phase,lu);
    const rows=[4,3,2,5,6,1].map(z=>c.pos[z]).filter(Boolean);
    return `<div class="effective-six"><span>IN CAMPO</span>${rows.map(x=>`<b>${x.slot} · ${esc(playerLabel(t,x.playerId))}</b>`).join('')}</div>`;
  }

  function metricsHtml(phase){
    const active=phase==='receive'?'SO':'BP';
    return `<div class="match-metrics"><div class="match-metric ${active==='SO'?'active':''}"><span>SIDE OUT</span><strong>—</strong></div><div class="match-metric ${active==='BP'?'active':''}"><span>BREAK POINT</span><strong>—</strong></div></div><div class="stats-pending">Indici individuali non ancora collegati. Nessun valore viene stimato o inventato.</div>`;
  }

  teamEditorHtml=function(t){return `<div class="team-head"><div><div class="eyebrow">${esc(season(t.seasonId)?.name||'')} · ${esc(comp(t.competitionId)?.name||'')}</div><h3>${esc(t.name)}</h3></div><button class="btn danger" id="deleteTeam">Elimina</button></div><h3>Roster</h3><p class="muted">Qui gestisci solo i giocatori disponibili. Il sestetto viene scelto ogni volta nella pagina Partita.</p><div class="player-form"><input id="pNum" placeholder="#"><input id="pName" placeholder="Nome e cognome"><select id="pRole"><option>S</option><option>OP</option><option>OH</option><option>MB</option><option>L</option></select><button class="btn primary" id="addPlayer">Aggiungi</button></div><div id="rosterWrap"></div>`};

  bindTeamEditor=function(t){
    deleteTeam.onclick=()=>{if(confirm('Eliminare questa squadra?')){state.teams=state.teams.filter(x=>x.id!==t.id);state.selectedTeamId=null;save();renderTeams()}};
    addPlayer.onclick=()=>{if(!pName.value.trim())return;t.roster.push({id:uid(),number:pNum.value.trim(),name:pName.value.trim(),role:pRole.value});save();renderTeams()};
    renderRoster(t);
  };

  renderMatchLineups=function(){
    matchLineups.innerHTML='';
    const data=[
      ['NOI',team(state.match.ourTeamId),state.match.ourRotation,state.match.ourPhase,'our'],
      ['LORO',team(state.match.oppTeamId),state.match.oppRotation,opp(state.match.ourPhase),'opp']
    ];
    for(const [label,t,r,phase,side] of data){
      const card=document.createElement('div');
      card.className='lineup-card';
      card.innerHTML=`<div class="lineup-card-head"><div><h4>${label}${t?' · '+esc(t.name):''}</h4><small>SESTETTO PARTITA</small></div></div>${lineupEditor(t,side)}${t?courtHtml(t,r,phase,lineupFor(side))+activePlayersHtml(t,r,phase,lineupFor(side))+metricsHtml(phase):''}`;
      matchLineups.appendChild(card);
    }
    matchLineups.querySelectorAll('select[data-match-side]').forEach(sel=>sel.onchange=()=>{
      const side=sel.dataset.matchSide,slot=sel.dataset.matchSlot,lu=lineupFor(side),id=sel.value;
      if(id)SLOTS.forEach(k=>{if(k!==slot&&lu[k]===id)lu[k]=''});
      lu[slot]=id;
      save();
      cyclePanel.classList.add('hidden');
      renderMatchLineups();
    });
  };

  renderMatch=function(){
    matchSeasonSelect.innerHTML=seasonOptions(state.match.seasonId);
    matchCompetitionSelect.innerHTML=compOptions(state.match.seasonId,state.match.competitionId);
    matchSeasonSelect.onchange=()=>{state.match.seasonId=matchSeasonSelect.value;state.match.competitionId='';state.match.ourTeamId=state.match.oppTeamId=null;resetLineup('our');resetLineup('opp');save();renderMatch()};
    matchCompetitionSelect.onchange=()=>{state.match.competitionId=matchCompetitionSelect.value;state.match.ourTeamId=state.match.oppTeamId=null;resetLineup('our');resetLineup('opp');save();renderMatch()};
    [['ourTeamSelect','ourTeamId','our'],['oppTeamSelect','oppTeamId','opp']].forEach(([id,key,side])=>{
      const el=document.getElementById(id);
      el.innerHTML='<option value="">Seleziona squadra</option>'+eligibleTeams().map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
      el.value=state.match[key]||'';
      el.onchange=()=>{state.match[key]=el.value||null;resetLineup(side);save();renderMatchLineups()};
    });
    segment(ourPhaseSegment,state.match.ourPhase,p=>{state.match.ourPhase=p;save();oppPhaseLabel.textContent=PHASE[opp(p)];cyclePanel.classList.add('hidden');renderMatchLineups()});
    oppPhaseLabel.textContent=PHASE[opp(state.match.ourPhase)];
    picker(ourRotationPicker,state.match.ourRotation,r=>{state.match.ourRotation=r;save();renderMatchLineups();cyclePanel.classList.add('hidden')});
    picker(oppRotationPicker,state.match.oppRotation,r=>{state.match.oppRotation=r;save();renderMatchLineups();cyclePanel.classList.add('hidden')});
    renderMatchLineups();
  };

  renderCycle=function(root,c){
    const a=team(state.match.ourTeamId),b=team(state.match.oppTeamId);
    root.innerHTML=c.map(x=>{
      const ac=effectiveCourt(a,x.ourRotation,x.ourPhase,state.match.ourLineup);
      const bc=effectiveCourt(b,x.oppRotation,x.oppPhase,state.match.oppLineup);
      const aSix=ac?[4,3,2,5,6,1].map(z=>ac.pos[z]).filter(Boolean):[];
      const bSix=bc?[4,3,2,5,6,1].map(z=>bc.pos[z]).filter(Boolean):[];
      return `<div class="cycle-row-rich"><div class="cycle-top"><div class="cycle-num">${x.n}</div><div class="state-chip ${x.ourPhase}">NOI ${SHORT[x.ourPhase]} ${x.ourRotation}</div><div class="arrow">${x.ourPhase==='serve'?'→':'←'}</div><div class="state-chip ${x.oppPhase}">LORO ${SHORT[x.oppPhase]} ${x.oppRotation}</div></div><div class="cycle-detail"><div><b>NOI IN CAMPO</b><span>${aSix.length?aSix.map(y=>y.slot+(y.player?.number?' #'+y.player.number:'')).join(' · '):'—'}</span></div><div><b>LORO IN CAMPO</b><span>${bSix.length?bSix.map(y=>y.slot+(y.player?.number?' #'+y.player.number:'')).join(' · '):'—'}</span></div><div><b>BATTITORE</b><span>${x.ourPhase==='serve'?(ac?playerLabel(a,ac.server.playerId):'—'):(bc?playerLabel(b,bc.server.playerId):'—')}</span></div><div><b>INDICE FASE</b><span>${x.ourPhase==='serve'?'BREAK POINT':'SIDE OUT'} · —</span></div></div></div>`;
    }).join('');
  };

  generateCycle.onclick=()=>{
    if(!state.match.ourTeamId||!state.match.oppTeamId){alert('Seleziona entrambe le squadre.');return}
    const missing=[];
    if(SLOTS.some(k=>!state.match.ourLineup[k])) missing.push('NOI');
    if(SLOTS.some(k=>!state.match.oppLineup[k])) missing.push('LORO');
    if(missing.length){alert('Completa il sestetto partita (P, S1, C2, O, S2, C1, L) per '+missing.join(' e ')+'.');return}
    cyclePanel.classList.remove('hidden');
    cycleTitle.textContent=`NOI ${SHORT[state.match.ourPhase]} ${state.match.ourRotation} · LORO ${SHORT[opp(state.match.ourPhase)]} ${state.match.oppRotation}`;
    renderCycle(cycleList,cycle(state.match.ourPhase,state.match.ourRotation,state.match.oppRotation));
  };

  invertStart.onclick=()=>{state.match.ourPhase=opp(state.match.ourPhase);save();renderMatch()};

  const style=document.createElement('style');
  style.textContent=`
    .match-lineup-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 16px}
    .match-lineup-editor label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:#8799ad}
    .lineup-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .lineup-card-head small{color:#8799ad;font-weight:900;letter-spacing:.12em}
    .mini-court-grid small{display:inline;font-size:10px;color:#f0c41d;font-weight:800}
    .effective-six{display:grid;gap:6px;margin-top:14px;padding:12px;border:1px solid #20354b;border-radius:12px;background:#091523}
    .effective-six>span{font-size:10px;color:#87a4bf;font-weight:900;letter-spacing:.12em}
    .effective-six b{font-size:12px;font-weight:800}
    .match-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
    .match-metric{padding:12px;border:1px solid #20354b;border-radius:12px;background:#091523}
    .match-metric span{display:block;font-size:10px;color:#87a4bf;font-weight:900;letter-spacing:.1em}
    .match-metric strong{display:block;font-size:24px;margin-top:4px}
    .match-metric.active{outline:2px solid #f0c41d;outline-offset:-2px}
    .stats-pending{margin-top:8px;font-size:11px;color:#8799ad;line-height:1.35}
    @media(max-width:760px){.match-lineup-editor{grid-template-columns:1fr}.lineup-pair{grid-template-columns:1fr}.match-metrics{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  const homeTeams=document.querySelector('[data-go="teams"] small');
  if(homeTeams)homeTeams.textContent='Roster giocatori';
  const teamsEyebrow=document.querySelector('#view-teams .eyebrow');
  if(teamsEyebrow)teamsEyebrow.textContent='ROSTER';

  save();renderTeams();renderMatch();
})();
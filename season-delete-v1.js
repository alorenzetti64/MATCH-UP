// MATCH-UP: eliminazione sicura di una stagione e dei dati collegati.
(function(){
  const baseRenderData=renderData;

  function clearMatchIfSeasonDeleted(seasonId){
    if(state.match?.seasonId===seasonId){
      state.match={...blank.match};
      if(typeof SLOTS!=='undefined'){
        state.match.ourLineup=Object.fromEntries(SLOTS.map(s=>[s,'']));
        state.match.oppLineup=Object.fromEntries(SLOTS.map(s=>[s,'']));
      }
    }
    if(state.filters?.seasonId===seasonId){
      state.filters.seasonId='';
      state.filters.competitionId='';
    }
    const selected=team(state.selectedTeamId);
    if(selected?.seasonId===seasonId) state.selectedTeamId=null;
  }

  function deleteSeason(seasonId){
    const s=season(seasonId);
    if(!s)return;
    const comps=state.competitions.filter(c=>c.seasonId===seasonId);
    const compIds=new Set(comps.map(c=>c.id));
    const teams=state.teams.filter(t=>t.seasonId===seasonId || compIds.has(t.competitionId));
    const players=teams.reduce((n,t)=>n+(t.roster?.length||0),0);
    const ok=confirm(`Eliminare la stagione ${s.name}?\n\nVerranno eliminati anche:\n• ${comps.length} competizioni\n• ${teams.length} squadre\n• ${players} giocatori\n\nQuesta operazione non si può annullare.`);
    if(!ok)return;

    state.competitions=state.competitions.filter(c=>c.seasonId!==seasonId);
    state.teams=state.teams.filter(t=>t.seasonId!==seasonId && !compIds.has(t.competitionId));
    state.seasons=state.seasons.filter(x=>x.id!==seasonId);
    clearMatchIfSeasonDeleted(seasonId);
    save();
    renderData();
    renderTeams();
    renderMatch();
  }

  renderData=function(){
    baseRenderData();
    if(!state.seasons.length)return;
    seasonList.innerHTML=state.seasons.map(s=>`<span class="chip season-chip"><span>${esc(s.name)}</span><button type="button" class="season-delete" data-season-delete="${s.id}" title="Elimina stagione">×</button></span>`).join('');
    seasonList.querySelectorAll('[data-season-delete]').forEach(btn=>{
      btn.onclick=()=>deleteSeason(btn.dataset.seasonDelete);
    });
  };

  const style=document.createElement('style');
  style.textContent=`
    .season-chip{display:inline-flex;align-items:center;gap:8px}
    .season-delete{border:0;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer;opacity:.7;padding:0 2px}
    .season-delete:hover{opacity:1;color:#ff6b6b}
  `;
  document.head.appendChild(style);
  renderData();

  setTimeout(async()=>{
    const pin=localStorage.getItem('sir_matchup_cloud_pin')||'';
    if(!pin)return;
    const el=document.querySelector('#saveStatus');
    try{
      const r=await fetch('https://rwfxsbxxykocdcqphfvb.supabase.co/functions/v1/matchup-state',{
        method:'GET',headers:{'x-matchup-pin':pin}
      });
      if(el)el.textContent=r.ok?'Cloud':'Offline';
    }catch(e){
      if(el)el.textContent='Offline';
    }
  },1400);
})();

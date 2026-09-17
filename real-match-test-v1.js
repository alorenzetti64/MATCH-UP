// MATCH-UP · primo collegamento a dati reali 2025/26
(function(){
  const API='https://kwgfexwujbsrhqpwkrtt.supabase.co/functions/v1/matchup-read';
  const TEST_MATCH_ID='89236f67-6cc5-dab5-37d8-447da9705a4e'; // Perugia-Cuneo, 13/11/2025

  function pct(w,a){return a?((w/a)*100).toFixed(1)+'%':'—'}
  function escLocal(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function ensurePanel(){
    const view=document.querySelector('#view-match');
    if(!view || document.querySelector('#realMatchTest')) return;
    const panel=document.createElement('div');
    panel.className='panel';
    panel.id='realMatchTest';
    panel.innerHTML=`
      <div class="section-head mini">
        <div><div class="eyebrow">TEST DATI REALI · 2025/26</div><h3>Perugia – Cuneo · 13 novembre 2025</h3></div>
      </div>
      <p class="muted">Primo controllo del collegamento con gli scout reali. In questa fase leggiamo Side Out e Break complessivi della gara; il dettaglio per rotazione sarà il passo successivo.</p>
      <button class="btn primary wide" id="loadRealMatchTest">CARICA DATI REALI</button>
      <div id="realMatchTestBody" style="margin-top:14px"></div>`;
    view.appendChild(panel);
    document.querySelector('#loadRealMatchTest').onclick=loadTest;
  }

  async function loadTest(){
    const body=document.querySelector('#realMatchTestBody');
    const btn=document.querySelector('#loadRealMatchTest');
    if(!body)return;
    body.innerHTML='<p class="muted">Caricamento dati reali…</p>';
    if(btn)btn.disabled=true;
    try{
      const r=await fetch(`${API}?match_id=${encodeURIComponent(TEST_MATCH_ID)}`);
      if(!r.ok) throw new Error('HTTP '+r.status);
      const d=await r.json();
      const teamById=Object.fromEntries((d.teams||[]).map(t=>[t.id,t]));
      const stats=(d.stats||[]).map(s=>({
        ...s,
        name:teamById[s.team_id]?.canonical_name||'Squadra'
      }));
      const score=`${d.match?.home_sets ?? '—'}-${d.match?.away_sets ?? '—'}`;
      const sets=(d.sets||[]).map(s=>`${s.home_points}-${s.away_points}`).join(' · ');
      const cards=stats.map(s=>`
        <div class="metric" style="min-width:220px;flex:1">
          <span>${escLocal(s.name)}</span>
          <strong>SO ${pct(s.side_out_wins,s.side_out_attempts)}</strong>
          <small>${s.side_out_wins}/${s.side_out_attempts} · BREAK ${pct(s.break_wins,s.break_attempts)} (${s.break_wins}/${s.break_attempts})</small>
        </div>`).join('');
      const playersByTeam={};
      (d.players||[]).forEach(p=>{(playersByTeam[p.team_id]??=[]).push(p)});
      const playerHtml=Object.entries(playersByTeam).map(([tid,arr])=>`
        <div style="margin-top:12px"><b>${escLocal(teamById[tid]?.canonical_name||'Squadra')}</b><div class="chip-list" style="margin-top:8px">${arr.map(p=>`<span class="chip">#${escLocal(p.number)} ${escLocal(p.name)}</span>`).join('')}</div></div>`).join('');
      body.innerHTML=`
        <div class="current-start"><b>RISULTATO REALE:</b> ${score}${sets?' · set '+escLocal(sets):''}</div>
        <div class="metric-strip" style="margin-top:12px">${cards}</div>
        <div style="margin-top:16px"><div class="eyebrow">GIOCATORI RICONOSCIUTI NELLO SCOUT</div>${playerHtml}</div>
        <p class="muted" style="margin-top:14px">✓ Collegamento reale attivo. Nessun dato statistico è simulato.</p>`;
    }catch(e){
      console.error(e);
      body.innerHTML='<p class="muted">Non riesco a leggere i dati reali in questo momento.</p>';
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  ensurePanel();
})();

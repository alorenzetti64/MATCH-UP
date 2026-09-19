// MATCH-UP · visualizzazione grafica delle 6 rotazioni per fase
(function(){
  const ROTS=['P1','P6','P5','P4','P3','P2'];
  const SERVE_SLOT={P1:'P',P6:'S1',P5:'C2',P4:'O',P3:'S2',P2:'C1'};
  const ROTATION_ZONES={
    P1:{1:'P',2:'S1',3:'C2',4:'O',5:'S2',6:'C1'},
    P6:{1:'S1',2:'C2',3:'O',4:'S2',5:'C1',6:'P'},
    P5:{1:'C2',2:'O',3:'S2',4:'C1',5:'P',6:'S1'},
    P4:{1:'O',2:'S2',3:'C1',4:'P',5:'S1',6:'C2'},
    P3:{1:'S2',2:'C1',3:'P',4:'S1',5:'C2',6:'O'},
    P2:{1:'C1',2:'P',3:'S1',4:'C2',5:'O',6:'S2'}
  };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function teamById(id){return state.teams.find(t=>t.id===id)}
  function playerNum(t,lineup,slot){
    const p=t?.roster?.find(x=>x.id===lineup?.[slot]);
    return p?.number||'';
  }
  function teamName(t){return t?.name||'Squadra'}
  function shortName(s){return String(s||'').replace(/^Sir Susa Scai /i,'').replace(/^Itas /i,'').trim()}

  function roleAtZone(rot,z){
    return ROTATION_ZONES[rot]?.[z]||'';
  }
  function isFrontZone(z){return z===2||z===3||z===4}
  function isMiddle(slot){return slot==='C1'||slot==='C2'}
  function isWing(slot){return slot==='S1'||slot==='S2'}
  function isRight(slot){return slot==='P'||slot==='O'}

  function token(label,setter=false,lib=false){
    if(!label && !lib)return '<span class="mg-empty"></span>';
    return '<span class="mg-token'+(setter?' mg-setter':'')+(lib?' mg-lib':'')+'">'+esc(lib?'LIB':label)+'</span>';
  }

  function normalReception(team,lineup,rot){
    const zones={};
    for(let z=1;z<=6;z++){
      const slot=roleAtZone(rot,z);
      const lib=isMiddle(slot)&&!isFrontZone(z);
      zones[z]=token(playerNum(team,lineup,slot),slot==='P'&&!lib,lib);
    }
    return zones;
  }

  function breakPoint(team,lineup,rot){
    const zones={1:'',2:'',3:'',4:'',5:'',6:''};
    const server=SERVE_SLOT[rot];
    let serverHtml='';
    for(let z=1;z<=6;z++){
      const slot=roleAtZone(rot,z);
      const front=isFrontZone(z);
      const num=playerNum(team,lineup,slot);
      if(slot===server){
        serverHtml=token(num,slot==='P',false);
        continue;
      }
      if(front){
        if(isRight(slot)) zones[2]=token(num,slot==='P',false);
        else if(isMiddle(slot)) zones[3]=token(num,false,false);
        else if(isWing(slot)) zones[4]=token(num,false,false);
      }else{
        if(isRight(slot)) zones[1]=token(num,slot==='P',false);
        else if(isWing(slot)) zones[6]=token(num,false,false);
        else if(isMiddle(slot)) zones[5]=token('',false,true);
      }
    }
    return {zones,serverHtml};
  }

  function courtGrid(zones,kind){
    return '<div class="mg-court '+kind+'">'+
      '<div class="mg-zone z1">'+zones[1]+'</div>'+
      '<div class="mg-zone z6">'+zones[6]+'</div>'+
      '<div class="mg-zone z5">'+zones[5]+'</div>'+
      '<div class="mg-zone z2">'+zones[2]+'</div>'+
      '<div class="mg-zone z3">'+zones[3]+'</div>'+
      '<div class="mg-zone z4">'+zones[4]+'</div>'+
    '</div>';
  }

  function matchupCard(st,servingOur,ourTeam,oppTeam,ourLineup,oppLineup){
    const serveTeam=servingOur?ourTeam:oppTeam;
    const receiveTeam=servingOur?oppTeam:ourTeam;
    const serveLineup=servingOur?ourLineup:oppLineup;
    const receiveLineup=servingOur?oppLineup:ourLineup;
    const serveRot=servingOur?st.ourRotation:st.oppRotation;
    const receiveRot=servingOur?st.oppRotation:st.ourRotation;
    const bp=breakPoint(serveTeam,serveLineup,serveRot);
    const rx=normalReception(receiveTeam,receiveLineup,receiveRot);
    return '<article class="mg-pair">'+
      '<div class="mg-rot-label"><b>'+esc(shortName(teamName(serveTeam)))+' BT.</b><span>'+esc(serveRot)+'</span></div>'+
      (bp.serverHtml?'<div class="mg-server"><small>BATTUTA</small>'+bp.serverHtml+'</div>':'')+
      courtGrid(bp.zones,'mg-break')+
      '<div class="mg-net">RETE</div>'+
      courtGrid(rx,'mg-receive')+
      '<div class="mg-rot-label bottom"><span>'+esc(receiveRot)+'</span><b>'+esc(shortName(teamName(receiveTeam)))+' RIC.</b></div>'+
    '</article>';
  }

  function styles(){
    if(document.querySelector('#matchupGraphicStyles'))return;
    const s=document.createElement('style');s.id='matchupGraphicStyles';s.textContent=`
      .mg-wrap{margin-top:14px}
      .mg-tabs{display:flex;gap:6px;align-items:flex-end;margin:0 0 0 14px;overflow:auto}
      .mg-tab{border:1px solid #6e3b1d;background:#d9dde2;color:#101820;padding:11px 18px;border-radius:14px 14px 0 0;font-weight:900;white-space:nowrap;cursor:pointer}
      .mg-tab.active{background:#f07a32;text-decoration:underline;text-underline-offset:3px}
      .mg-board{background:#176987;border:1px solid #2a839f;border-radius:34px;padding:18px 14px 22px;overflow:hidden}
      .mg-strip{display:grid;grid-template-columns:repeat(6,minmax(180px,1fr));gap:12px;overflow-x:auto;padding:4px 4px 8px;scroll-snap-type:x mandatory}
      .mg-pair{min-width:180px;scroll-snap-align:start}
      .mg-rot-label{display:flex;justify-content:center;align-items:center;gap:9px;color:#fff;font-size:.84rem;font-weight:800;margin-bottom:7px}
      .mg-rot-label span{background:#06121e;color:#fff;padding:5px 9px;border-radius:4px;font-size:.9rem}
      .mg-rot-label.bottom{margin:8px 0 0;flex-direction:column;gap:5px}
      .mg-rot-label.bottom span{background:#fff;color:#102030}
      .mg-server{height:42px;display:flex;justify-content:center;align-items:center;gap:7px;color:#fff}
      .mg-server small{font-size:.62rem;letter-spacing:.08em;font-weight:900;opacity:.82}
      .mg-court{display:grid;grid-template-columns:repeat(3,1fr);grid-template-areas:"z1 z6 z5" "z2 z3 z4";border:2px solid #0a1824;min-height:112px}
      .mg-zone{min-height:55px;display:grid;place-items:center;border-right:1px solid rgba(5,15,25,.32);border-bottom:1px solid rgba(5,15,25,.32);font-weight:900}
      .mg-zone:nth-child(3n){border-right:0}.mg-zone:nth-child(n+4){border-bottom:0}
      .z1{grid-area:z1}.z2{grid-area:z2}.z3{grid-area:z3}.z4{grid-area:z4}.z5{grid-area:z5}.z6{grid-area:z6}
      .mg-break{background:#fff700;color:#050505}
      .mg-receive{background:#d7d9dc;color:#07111f}
      .mg-net{text-align:center;background:#10283a;color:#f5f7fa;font-size:.62rem;font-weight:900;letter-spacing:.18em;padding:4px 0}
      .mg-token{min-width:30px;min-height:30px;padding:4px 6px;display:inline-grid;place-items:center;border-radius:3px;font-size:1rem;font-weight:950}
      .mg-setter{border:3px solid #050505;background:rgba(255,255,255,.3)}
      .mg-lib{font-size:.82rem;text-decoration:underline;text-underline-offset:2px}
      .mg-empty{display:block;min-width:24px;min-height:24px}
      .mg-help{color:#c9dbe7;font-size:.78rem;margin:10px 6px 0}
      @media(max-width:820px){
        .mg-board{margin-left:-8px;margin-right:-8px;border-radius:24px;padding:14px 8px 16px}
        .mg-strip{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(205px,78vw);gap:10px}
        .mg-pair{min-width:0}
        .mg-tab{padding:10px 14px;font-size:.88rem}
      }
    `;document.head.appendChild(s);
  }

  window.renderMatchupGraphic=function(root,pair){
    if(!root||!pair?.states)return;
    styles();
    const ourTeam=teamById(state.match.ourTeamId),oppTeam=teamById(state.match.oppTeamId);
    const ourLineup=state.match.ourLineup||{},oppLineup=state.match.oppLineup||{};
    const ourServe=pair.states.filter(x=>x.ourPhase==='serve');
    const oppServe=pair.states.filter(x=>x.ourPhase==='receive');
    const ourName=shortName(teamName(ourTeam)),oppName=shortName(teamName(oppTeam));
    root.innerHTML='<div class="mg-wrap">'+
      '<div class="mg-tabs">'+
        '<button class="mg-tab active" data-mg-tab="our">'+esc(ourName)+' Battuta</button>'+
        '<button class="mg-tab" data-mg-tab="opp">'+esc(oppName)+' Battuta</button>'+
      '</div>'+
      '<div class="mg-board">'+
        '<div class="mg-strip" data-mg-panel="our">'+ourServe.map(st=>matchupCard(st,true,ourTeam,oppTeam,ourLineup,oppLineup)).join('')+'</div>'+
        '<div class="mg-strip hidden" data-mg-panel="opp">'+oppServe.map(st=>matchupCard(st,false,ourTeam,oppTeam,ourLineup,oppLineup)).join('')+'</div>'+
        '<div class="mg-help">Bordo nero = alzatore · LIB = libero al posto del centrale in seconda linea.</div>'+
      '</div>'+
    '</div>';
    root.querySelectorAll('[data-mg-tab]').forEach(btn=>btn.onclick=()=>{
      const side=btn.dataset.mgTab;
      root.querySelectorAll('[data-mg-tab]').forEach(x=>x.classList.toggle('active',x===btn));
      root.querySelectorAll('[data-mg-panel]').forEach(x=>x.classList.toggle('hidden',x.dataset.mgPanel!==side));
    });
  };
})();
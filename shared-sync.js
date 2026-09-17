// MATCH-UP cloud sync via Supabase Edge Function.
(function(){
  const STATE_KEY='sir_matchup_web_v3';
  const PIN_KEY='sir_matchup_cloud_pin';
  const API='https://rwfxsbxxykocdcqphfvb.supabase.co/functions/v1/matchup-state';
  let cloudReady=false;
  let syncing=false;
  let timer=null;

  function badge(text){
    const el=document.querySelector('#saveStatus');
    if(el) el.textContent=text;
  }

  async function request(method,pin,payload){
    const r=await fetch(API,{
      method,
      headers:{'Content-Type':'application/json','x-matchup-pin':pin},
      body: payload===undefined ? undefined : JSON.stringify({payload})
    });
    if(r.status===401) throw new Error('PIN');
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  function rerender(){
    try{renderData();renderTeams();renderMatch();renderQuick()}catch(e){console.warn(e)}
  }

  async function pushNow(){
    if(!cloudReady||syncing)return;
    const pin=localStorage.getItem(PIN_KEY)||'';
    if(!pin)return;
    syncing=true;
    badge('Salvataggio…');
    try{
      await request('PUT',pin,state);
      badge('Cloud');
    }catch(e){
      console.error('MATCH-UP cloud save',e);
      badge('Offline');
    }finally{syncing=false}
  }

  function schedulePush(){
    clearTimeout(timer);
    timer=setTimeout(pushNow,350);
  }

  async function connect(){
    let pin=localStorage.getItem(PIN_KEY)||'';
    if(!pin){
      pin=prompt('Inserisci il codice MATCH-UP per collegare il database condiviso:')||'';
      if(!pin){badge('Locale');return}
    }
    badge('Connessione…');
    try{
      let remote=await request('GET',pin);
      localStorage.setItem(PIN_KEY,pin);
      if(remote.payload && typeof remote.payload==='object'){
        state={...clone(blank),...remote.payload,
          filters:{...blank.filters,...(remote.payload.filters||{})},
          match:{...blank.match,...(remote.payload.match||{})},
          quick:{...blank.quick,...(remote.payload.quick||{})}
        };
        localStorage.setItem(STATE_KEY,JSON.stringify(state));
        rerender();
      }else{
        await request('PUT',pin,state);
      }
      cloudReady=true;
      badge('Cloud');

      const oldSave=save;
      save=function(){
        oldSave();
        schedulePush();
      };

      const p=document.querySelector('#view-data .danger-zone .muted');
      if(p)p.textContent='I dati sono sincronizzati nel database condiviso MATCH-UP. Il browser conserva anche una copia locale.';
      const reset=document.querySelector('#resetLocal');
      if(reset)reset.textContent='Reset copia locale';
    }catch(e){
      if(e.message==='PIN'){
        localStorage.removeItem(PIN_KEY);
        badge('Codice errato');
        alert('Codice MATCH-UP non corretto. Ricarica la pagina e riprova.');
      }else{
        console.error('MATCH-UP cloud connect',e);
        badge('Offline');
      }
    }
  }

  connect();
})();
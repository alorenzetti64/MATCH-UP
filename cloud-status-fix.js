// Recheck the real cloud connection after the legacy local-save startup timer.
(function(){
  const API='https://rwfxsbxxykocdcqphfvb.supabase.co/functions/v1/matchup-state';
  const PIN_KEY='sir_matchup_cloud_pin';
  async function verifyCloud(){
    const pin=localStorage.getItem(PIN_KEY)||'';
    if(!pin)return;
    try{
      const r=await fetch(API,{method:'GET',headers:{'x-matchup-pin':pin}});
      const el=document.querySelector('#saveStatus');
      if(el)el.textContent=r.ok?'Cloud':'Offline';
    }catch(e){
      const el=document.querySelector('#saveStatus');
      if(el)el.textContent='Offline';
    }
  }
  setTimeout(verifyCloud,1400);
})();
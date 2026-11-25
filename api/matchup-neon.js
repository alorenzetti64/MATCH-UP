import pg from 'pg';
const {Pool}=pg;
const ROT=['P1','P6','P5','P4','P3','P2'];
const SLOT_ROT={P:'P1',S1:'P6',C2:'P5',O:'P4',S2:'P3',C1:'P2'};
const ROT_SLOT=Object.fromEntries(Object.entries(SLOT_ROT).map(([k,v])=>[v,k]));
const pct=(w,a)=>a?100*w/a:null;
const num=v=>/^\d{1,3}$/.test(String(v??'').trim())?String(v).trim().padStart(2,'0'):'';
const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
let pool;
function resolveTeam(name,names){const n=norm(name);const aliases=n==='trento'?['trento','trentino']:n==='trentino'?['trentino','trento']:[n];const exact=names.filter(x=>aliases.includes(norm(x)));if(exact.length===1)return exact[0];const hits=names.filter(x=>aliases.some(a=>a&&norm(x).split(' ').includes(a)));return hits.length===1?hits[0]:null;}
function cycle(ourPhase,ourRot,oppRot){let a=ourPhase,b=ourPhase==='serve'?'receive':'serve',ar=ourRot,br=oppRot,out=[];for(let i=0;i<12;i++){out.push({ourPhase:a,ourRotation:ar,oppPhase:b,oppRotation:br});if(a==='receive')ar=ROT[(ROT.indexOf(ar)+1)%6];if(b==='receive')br=ROT[(ROT.indexOf(br)+1)%6];a=a==='serve'?'receive':'serve';b=b==='serve'?'receive':'serve';}return out}
function serviceType(action){const m=String(action||'').match(/^S([QM])/);if(!m)return null;return m[1]==='Q'?'spin':'float'}
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
function seeded(seed){let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}


export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){
  try{if(!process.env.NEON_DATABASE_URL)return res.status(503).json({error:'not_configured'});
  pool??=new Pool({connectionString:process.env.NEON_DATABASE_URL,max:3,connectionTimeoutMillis:8000,statement_timeout:15000});
  const q=await pool.query("SELECT count(*)::int AS matches FROM public.matches WHERE season=$1",['2026-2027']);
  return res.json({status:'ok',season:'2026/27',matches:q.rows[0].matches});}catch(e){return res.status(503).json({error:'database_unavailable',code:e.code||'connection'});}
 }
 if(req.method!=='POST')return res.status(405).json({error:'method'});
 try{
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!body||body.season!=='2026/27')return res.status(400).json({error:'invalid_season'});
 if(!process.env.NEON_DATABASE_URL)return res.status(503).json({error:'not_configured'});
 pool??=new Pool({connectionString:process.env.NEON_DATABASE_URL,max:3,connectionTimeoutMillis:8000,statement_timeout:15000});
 const season='2026-2027',lu=body.our_lineup||{},lt=body.opp_lineup||{},mix=body.serve_mix||{};
 const serverMap=l=>Object.fromEntries(Object.entries(SLOT_ROT).map(([slot,rot])=>[num(l[slot]),rot]).filter(([n])=>n));
 const mapUs=serverMap(lu),mapThem=serverMap(lt);
 if(Object.keys(mapUs).length!==6||Object.keys(mapThem).length!==6)return res.status(400).json({error:'lineup_incomplete'});
 const names=(await pool.query('SELECT DISTINCT team_name FROM public.team_rotation_rallies WHERE season=$1 AND team_name IS NOT NULL',[season])).rows.map(x=>x.team_name);
 const un=resolveTeam(body.our_team,names),tn=resolveTeam(body.opp_team,names);
 if(!un||!tn||un===tn)return res.status(404).json({error:'team_not_found'});
 const us={id:'2026-27:'+un,canonical_name:un},them={id:'2026-27:'+tn,canonical_name:tn},tids=[us.id,them.id];
 const selected={},stats={},profiles={},rec={};
 for(const [t,l] of [[us,lu],[them,lt]]){selected[t.id]=new Set(Object.values(l).map(num).filter(Boolean));stats[t.id]=Object.fromEntries(ROT.map(r=>[r,{soA:0,soW:0,bA:0,bW:0}]));profiles[t.id]={};rec[t.id]={};}
 const rr=(await pool.query(`SELECT team_name,rotation_anchor_player,serve_type,sum(so_attempt)::int AS sa,sum(so_win)::int AS sw,sum(break_attempt)::int AS ba,sum(break_win)::int AS bw
 FROM public.team_rotation_rallies WHERE season=$1 AND team_name=ANY($2::text[]) GROUP BY 1,2,3`,[season,[un,tn]])).rows;
 for(const row of rr){const t=row.team_name===un?us:them,sm=t===us?mapUs:mapThem,p=num(row.rotation_anchor_player),rot=sm[p];if(!rot)continue;const x=stats[t.id][rot];x.soA+=row.sa||0;x.soW+=row.sw||0;x.bA+=row.ba||0;x.bW+=row.bw||0;}
 // Use actual serving player from player rally rows, and the team row for serve type / rotation anchor.
 const pr=(await pool.query(`SELECT p.team_name,p.player_code,t.rotation_anchor_player,t.serve_type,
 sum(coalesce(p.serves,0))::int AS serves,
 sum(coalesce(p.so_receptions_spin,0))::int AS sa,
 sum(coalesce(p.so_sideout_wins_after_reception_spin,0))::int AS sw,
 sum(coalesce(p.so_receptions_float,0))::int AS fa,
 sum(coalesce(p.so_sideout_wins_after_reception_float,0))::int AS fw
 FROM public.player_rotation_rallies p JOIN public.team_rotation_rallies t
 ON t.match_id=p.match_id AND t.set_number=p.set_number AND t.rally_index=p.rally_index AND t.team_side=p.team_side AND t.season=p.season
 WHERE p.season=$1 AND p.team_name=ANY($2::text[]) GROUP BY 1,2,3,4`,[season,[un,tn]])).rows;
 for(const row of pr){const t=row.team_name===un?us:them,tid=t.id,sm=t===us?mapUs:mapThem,p=num(row.player_code),rot=sm[num(row.rotation_anchor_player)];if(!selected[tid].has(p))continue;
 if(['spin','float'].includes(row.serve_type)&&row.serves){profiles[tid][p]??={spin:0,float:0};profiles[tid][p][row.serve_type]+=row.serves;}
 if(!rot)continue;rec[tid][rot]??={spin:{},float:{}};for(const [type,a,w] of [['spin',row.sa,row.sw],['float',row.fa,row.fw]]){if(!a)continue;const c=rec[tid][rot][type][p]??={a:0,w:0};c.a+=a;c.w+=w;}
 }
 if(tids.some(id=>ROT.some(r=>!stats[id][r].soA||!stats[id][r].bA)))return res.status(422).json({error:'insufficient_rotation_data'});
 const result=compute();
 function compute(){  function rotFmt(tid){return ROT.map(r=>({rotation:r,so_attempts:stats[tid][r].soA,so_wins:stats[tid][r].soW,so_pct:pct(stats[tid][r].soW,stats[tid][r].soA),break_attempts:stats[tid][r].bA,break_wins:stats[tid][r].bW,break_pct:pct(stats[tid][r].bW,stats[tid][r].bA)}))}
  const ourR=rotFmt(us.id),oppR=rotFmt(them.id),om=Object.fromEntries(ourR.map(x=>[x.rotation,x])),tm=Object.fromEntries(oppR.map(x=>[x.rotation,x]));
  function profile(tid,p){const x=profiles[tid][p]||{spin:0,float:0},tot=x.spin+x.float,sp=tot?100*x.spin/tot:0,fp=tot?100*x.float/tot:0;let cls='unknown';if(tot){if(sp>=80)cls='spin';else if(fp>=80)cls='float';else cls='mixed'}return{number:p,spin:x.spin,float:x.float,total:tot,spin_pct:sp,float_pct:fp,classification:cls}}
  function groupSO(tid,rot,type){const by=rec[tid]?.[rot]?.[type]||{};let a=0,w=0;const players=[];for(const p of selected[tid]){const c=by[p];if(c?.a){a+=c.a;w+=c.w;players.push({number:p,attempts:c.a,wins:c.w,pct:100*c.w/c.a})}}return{attempts:a,wins:w,pct:a?100*w/a:null,players}}
  function receivePct(tid,rot,serverTid,serverNum){const pr=profile(serverTid,serverNum);const gs=groupSO(tid,rot,'spin'),gf=groupSO(tid,rot,'float');let spinWeight=pr.classification==='unknown'?null:pr.spin_pct/100;if(pr.classification==='spin')spinWeight=1;else if(pr.classification==='float')spinWeight=0;else if(pr.classification==='mixed'){const key=`${serverTid}:${serverNum}`;if(mix[key]!=null)spinWeight=clamp(Number(mix[key])/100)}let val=null;if(spinWeight===null)val=null;else if(gs.pct!=null&&gf.pct!=null)val=gs.pct*spinWeight+gf.pct*(1-spinWeight);else if(gs.pct!=null&&spinWeight===1)val=gs.pct;else if(gf.pct!=null&&spinWeight===0)val=gf.pct;return{pct:val,spin:gs,float:gf,profile:pr,spin_weight:spinWeight}}
  function stateEval(s){
    if(s.ourPhase==='serve'){
      const server=num(lu[ROT_SLOT[s.ourRotation]]),br=om[s.ourRotation]?.break_pct,rx=receivePct(them.id,s.oppRotation,us.id,server),fallback=tm[s.oppRotation]?.so_pct,so=rx.pct??fallback;
      const p=(br!=null&&so!=null)?clamp(((br/100)+(1-so/100))/2):null;return{...s,p_us:p,server_side:'our',server_number:server,server_profile:rx.profile,receiver_so:so,receiver_detail:rx,break_pct:br,fallback_used:rx.pct==null};
    }else{
      const server=num(lt[ROT_SLOT[s.oppRotation]]),soBase=om[s.ourRotation]?.so_pct,rx=receivePct(us.id,s.ourRotation,them.id,server),oppBreak=tm[s.oppRotation]?.break_pct,so=rx.pct??soBase;
      const p=(so!=null&&oppBreak!=null)?clamp(((so/100)+(1-oppBreak/100))/2):null;return{...s,p_us:p,server_side:'opp',server_number:server,server_profile:rx.profile,receiver_so:so,receiver_detail:rx,break_pct:oppBreak,fallback_used:rx.pct==null};
    }
  }
  function project(states,seedKey){const rng=seeded(seedKey);let usPts=0,opPts=0,wins=0,diff=0;const scoreFreq={};const N=7000;for(let n=0;n<N;n++){let a=0,b=0,i=0,guard=0;while(((a<25&&b<25)||Math.abs(a-b)<2)&&guard++<120){const st=states[i],p=st.p_us??0.5,uw=rng()<p;if(uw)a++;else b++;if((st.ourPhase==='receive'&&uw)||(st.ourPhase==='serve'&&!uw))i=(i+1)%12;}if(a>b)wins++;usPts+=a;opPts+=b;diff+=a-b;const key=`${a}-${b}`;scoreFreq[key]=(scoreFreq[key]||0)+1}const mode=Object.entries(scoreFreq).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';return{score:mode,win_pct:100*wins/N,avg_our:usPts/N,avg_opp:opPts/N,avg_diff:diff/N}}
  function evalPair(phase,orot,trot){const states=cycle(phase,orot,trot).map(stateEval),valid=states.filter(x=>x.p_us!=null),mean=valid.length?valid.reduce((a,x)=>a+x.p_us,0)/valid.length:null,fav=valid.filter(x=>x.p_us>.5).length;const proj=valid.length===12?project(states,`${phase}|${orot}|${trot}`):{score:'—',win_pct:null,avg_diff:null};return{phase,our_rotation:orot,opp_rotation:trot,value:mean==null?null:(mean-.5)*100,favorable_states:fav,states_used:valid.length,projected_score:proj.score,set_win_pct:proj.win_pct,avg_point_diff:proj.avg_diff,states};}
  const results={serve:[],receive:[]};for(const ph of ['serve','receive'])for(const tr of ROT)for(const or of ROT)results[ph].push(evalPair(ph,or,tr));
  for(const ph of ['serve','receive'])results[ph].sort((a,b)=>(b.set_win_pct-a.set_win_pct)||(b.avg_point_diff-a.avg_point_diff));
  const serveProfiles={our:{},opp:{}};for(const p of selected[us.id])serveProfiles.our[p]=profile(us.id,p);for(const p of selected[them.id])serveProfiles.opp[p]=profile(them.id,p);
  return ({our_team:{id:us.id,name:us.canonical_name,rotations:ourR},opp_team:{id:them.id,name:them.canonical_name,rotations:oppR},serve_profiles:serveProfiles,best:{serve:results.serve[0],receive:results.receive[0]},worst:{serve:results.serve[results.serve.length-1],receive:results.receive[results.receive.length-1]},all:results,method:'2026/27 Neon rally model: rotation + actual server type + individual receiver SO by rotation/type, weighted by reception volume'});
}
 return res.json({...result,season:'2026/27',source:'Neon DATA ROOM'});
 }catch(e){return res.status(503).json({error:'database_unavailable',code:e.code||'engine'});}
}

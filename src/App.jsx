import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

const holes=[[4,5],[3,15],[4,17],[4,1],[4,9],[5,11],[4,13],[4,3],[3,7],[4,10],[3,18],[4,6],[4,2],[4,14],[4,16],[5,4],[3,12],[4,8]].map(([par,strokeIndex],i)=>({number:i+1,par,strokeIndex}))
const GROUP_KEY='golf-scorekeeper-group'
const holeKey=id=>`golf-current-hole-${id}`
const strokes=(hcp,si)=>Math.floor(Math.max(0,+hcp||0)/18)+(si<=(Math.max(0,+hcp||0)%18)?1:0)
const isScore=v=>/^[1-9]$/.test(String(v))
const scoreNet=(value,hcp,hole)=>value==='X'?hole.par+2:isScore(value)?Math.min(+value-strokes(hcp,hole.strokeIndex),hole.par+2):null
const relative=n=>n===0?'E':n>0?`+${n}`:`${n}`
const maxGross=(hcp,hole)=>hole.par+2+strokes(hcp,hole.strokeIndex)

function resultFor(group,index){
	if(!group.submittedHoles[index])return {value:null,used:[]}
	const hole=holes[index]
	if(group.type==='scramble'){const n=scoreNet(group.scores[index],group.handicap,hole);return {value:n===null?null:n*2,used:[]}}
	const ranked=group.players.map(p=>({id:p.id,net:scoreNet(p.scores[index],p.handicap,hole)})).filter(x=>x.net!==null).sort((a,b)=>a.net-b.net)
	return {value:ranked.length<2?null:ranked[0].net+ranked[1].net,used:ranked.slice(0,2).map(x=>x.id)}
}
function roundFor(group){let total=0,par=0,thru=0;holes.forEach((hole,i)=>{const r=resultFor(group,i);if(r.value!==null){total+=r.value;par+=hole.par*2;thru++}});return {toPar:total-par,thru}}
function roundForPlayer(player,group){let total=0,par=0,thru=0;holes.forEach((hole,i)=>{if(!group.submittedHoles[i])return;const value=scoreNet(player.scores[i],player.handicap,hole);if(value!==null){total+=value;par+=hole.par;thru++}});return {toPar:total-par,thru}}
function roundForScramble(group){let total=0,par=0,thru=0;holes.forEach((hole,i)=>{if(!group.submittedHoles[i])return;const value=scoreNet(group.scores[i],group.handicap,hole);if(value!==null){total+=value;par+=hole.par;thru++}});return {toPar:total-par,thru}}

export default function App(){
	const game=useQuery(api.gameState.get),submitHole=useMutation(api.gameState.submitGroupHole),saveSettings=useMutation(api.gameState.saveSettings),resetRound=useMutation(api.gameState.resetRound)
	const [groupId,setGroupId]=useState(()=>localStorage.getItem(GROUP_KEY)),[screen,setScreen]=useState('entry'),[cardTarget,setCardTarget]=useState(null)
	const [holeIndex,setHoleIndex]=useState(()=>Math.max(0,Math.min(17,+localStorage.getItem(holeKey(localStorage.getItem(GROUP_KEY)))||0))),[draft,setDraft]=useState([]),[saving,setSaving]=useState(false),[confirmBlanks,setConfirmBlanks]=useState(false),[adminUnlocked,setAdminUnlocked]=useState(false),[settings,setSettings]=useState(null)
	const inputRefs=useRef([])
	const group=game?.groups.find(g=>g.id===groupId)
	const results=useMemo(()=>game?game.groups.map(g=>({group:g,...roundFor(g)})):[],[game])

	/* The remote scorecard is the source of truth; refresh the local per-hole draft when it changes. */
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(()=>{if(!group)return;setDraft(group.type==='scramble'?[group.scores[holeIndex]??'']:group.players.map(p=>p.scores[holeIndex]??''));setConfirmBlanks(false)},[group,holeIndex])
	if(!game)return <main className="loading">Walking to the first tee…</main>
	const selectGroup=id=>{localStorage.setItem(GROUP_KEY,id);setHoleIndex(Math.max(0,Math.min(17,+localStorage.getItem(holeKey(id))||0)));setGroupId(id);setScreen('entry')}
	if(screen==='admin')return <Admin groups={settings??game.groups} setGroups={setSettings} unlocked={adminUnlocked} onUnlock={()=>setAdminUnlocked(true)} onBack={()=>setScreen('entry')} onSave={async()=>{await saveSettings({password:'dutch',groups:settings});setScreen('entry')}} onReset={async()=>{await resetRound({password:'dutch'});setHoleIndex(0);if(groupId)localStorage.setItem(holeKey(groupId),'0');setScreen('entry')}}/>
	if(groupId==='spectator')return <main className="shell spectator"><header><button className="group-switch" onClick={()=>{localStorage.removeItem(GROUP_KEY);setGroupId(null)}}><span>Viewing</span>Live leaderboard⌄</button><button className="menu" onClick={()=>{setSettings(structuredClone(game.groups));setScreen('admin')}} aria-label="Organizer settings">•••</button></header><section className="spectator-head"><p className="eyebrow">Live match</p><h1>Follow the round</h1><p>Team and individual net standings update as each group submits a hole.</p></section><Leaderboard results={results} groups={game.groups} onOpen={setCardTarget}/>{cardTarget&&<Scorecard group={game.groups.find(g=>g.id===cardTarget.groupId)} playerId={cardTarget.playerId} individual={cardTarget.individual} onClose={()=>setCardTarget(null)}/>}</main>
	if(!groupId||!group)return <GroupPicker groups={game.groups} onSelect={selectGroup} onView={()=>{localStorage.setItem(GROUP_KEY,'spectator');setGroupId('spectator')}} onAdmin={()=>{setSettings(structuredClone(game.groups));setScreen('admin')}}/>

	const hole=holes[holeIndex],submitted=group.submittedHoles[holeIndex]
	const doSubmit=async scores=>{const filled=(scores??draft).map(v=>v||'X');setSaving(true);await submitHole({groupId:group.id,holeIndex,scores:filled});setSaving(false);setConfirmBlanks(false);if(holeIndex<17){const next=holeIndex+1;setHoleIndex(next);localStorage.setItem(holeKey(group.id),String(next))}}
	const setValue=(scoreIndex,value,advance=false)=>{const next=draft.map((v,i)=>i===scoreIndex?value:v);setDraft(next);if(next.length&&next.every(Boolean))setTimeout(()=>doSubmit(next),250);else if(advance&&scoreIndex<draft.length-1)setTimeout(()=>inputRefs.current[scoreIndex+1]?.focus(),0)}
	const attemptSubmit=()=>draft.some(v=>!v)?setConfirmBlanks(true):doSubmit()
	const moveHole=next=>{setHoleIndex(next);localStorage.setItem(holeKey(group.id),String(next))}
	return <main className="shell">
		<header><button className="group-switch" onClick={()=>setGroupId(null)}><span>Scoring</span>{group.name}⌄</button><button className="menu" onClick={()=>{setSettings(structuredClone(game.groups));setScreen('admin')}} aria-label="Organizer settings">•••</button></header>
		<Leaderboard results={results} groups={game.groups} onOpen={setCardTarget}/>
		<section className="card">
			<div className="hole-head"><div><p className="eyebrow">{submitted?'Submitted · tap save to update':'Now scoring'}</p><h1>Hole {hole.number}</h1></div><div className="facts"><span>PAR <b>{hole.par}</b></span><span>HCP <b>{hole.strokeIndex}</b></span></div></div>
			<div className="progress"><i style={{width:`${(holeIndex+1)/18*100}%`}}/></div>
			<div className="entry-title"><div><h2>{group.name}</h2><p>{group.type==='scramble'?`Scramble · HCP ${group.handicap} · net doubled`:'Gross scores · best two nets count'}</p></div><span>{holeIndex+1}<small>/18</small></span></div>
			{group.type==='scramble'?<ScoreRow name="Team score" members="Emma · Stacey · Tracey" hcp={group.handicap} value={draft[0]??''} hole={hole} inputRef={el=>inputRefs.current[0]=el} onValue={v=>setValue(0,v)}/>:group.players.map((p,i)=><ScoreRow key={p.id} name={p.name} hcp={p.handicap} value={draft[i]??''} hole={hole} inputRef={el=>inputRefs.current[i]=el} onValue={v=>setValue(i,v,v!=='')} />)}
			{confirmBlanks&&<div className="blank-warning"><strong>Record pickups?</strong><p>{group.type==='scramble'?'The team score':group.players.filter((_,i)=>!draft[i]).map(p=>p.name).join(', ')} will receive net double bogey.</p><div><button onClick={()=>setConfirmBlanks(false)}>Go back</button><button onClick={doSubmit}>Use net double bogey</button></div></div>}
			<button className="submit" disabled={saving} onClick={attemptSubmit}>{saving?'Saving…':submitted?'Update hole & continue':'Submit hole'}</button>
		</section>
		<nav><button disabled={!holeIndex} onClick={()=>moveHole(holeIndex-1)}>← {holeIndex?`Hole ${holeIndex}`:'Previous'}</button><span>{submitted?'Saved':'Draft'}</span><button disabled={holeIndex===17} onClick={()=>moveHole(holeIndex+1)}>{holeIndex<17?`Hole ${holeIndex+2} →`:'Finished'}</button></nav>
		{cardTarget&&<Scorecard group={game.groups.find(g=>g.id===cardTarget.groupId)} playerId={cardTarget.playerId} individual={cardTarget.individual} onClose={()=>setCardTarget(null)}/>}
	</main>
}

function ScoreRow({name,members,hcp,value,hole,onValue,inputRef}){const n=scoreNet(value,hcp,hole),cap=isScore(value)&&+value>maxGross(hcp,hole);return <div className={`score-row ${value==='X'?'picked':''}`}><div><strong>{name}</strong><span>{members??`HCP ${hcp}`}</span>{n!==null&&<small>{value==='X'?`Pickup · Net ${n}`:cap?`Net ${n} · capped from ${value}`:`Net ${n}`}</small>}</div><div className="score-control"><input ref={inputRef} inputMode="numeric" maxLength="1" value={value==='X'?'':value} placeholder="–" aria-label={`${name} gross score`} onChange={e=>{const v=e.target.value.replace(/[^1-9]/g,'').slice(-1);onValue(v)}}/><button className={value==='X'?'active':''} onClick={()=>onValue(value==='X'?'':'X')}><b>X</b><span>Pickup</span></button></div></div>}
function Leaderboard({results,groups,onOpen}){
	const [view,setView]=useState('teams')
	const players=groups.flatMap(group=>group.type==='scramble'?[{player:{id:`${group.id}-net`,name:group.name},group,isScramble:true,...roundForScramble(group)}]:group.players.map(player=>({player,group,isScramble:false,...roundForPlayer(player,group)}))).sort((a,b)=>a.thru&&b.thru?a.toPar-b.toPar:b.thru-a.thru)
	const teams=[...results].sort((a,b)=>a.thru&&b.thru?a.toPar-b.toPar:b.thru-a.thru)
	const leader=view==='teams'?teams.find(r=>r.thru)?.group.name:players.find(r=>r.thru)?.player.name
	return <section className="leaderboard">
		<div className="leader-tabs"><button className={view==='teams'?'active':''} onClick={()=>setView('teams')}>Teams</button><button className={view==='players'?'active':''} onClick={()=>setView('players')}>Players</button></div>
		<div className="leader-head"><div><p className="eyebrow">{view==='teams'?'Live team leader':'Individual net leader'}</p><h2>{leader??'Round ready'}</h2></div><span>NET</span></div>
		{view==='teams'?teams.map((r,i)=><button className="standing" key={r.group.id} onClick={()=>onOpen({groupId:r.group.id,individual:false})}><span>{String(i+1).padStart(2,'0')}</span><div><b>{r.group.name}</b><small>{r.thru?`Thru ${r.thru}`:'Not started'}</small></div><strong>{r.thru?relative(r.toPar):'—'}</strong><i>›</i></button>):players.map((r,i)=><button className="standing" key={r.player.id} onClick={()=>onOpen({groupId:r.group.id,playerId:r.isScramble?null:r.player.id,individual:true})}><span>{String(i+1).padStart(2,'0')}</span><div><b>{r.player.name}</b><small>{r.isScramble?'Scramble · single net':r.group.name} · {r.thru?`Thru ${r.thru}`:'Not started'}</small></div><strong>{r.thru?relative(r.toPar):'—'}</strong><i>›</i></button>)}
	</section>
}
function GroupPicker({groups,onSelect,onView,onAdmin}){return <main className="picker"><span className="brand">THREESOME</span><div><p className="eyebrow">Match day</p><h1>What are you here to do?</h1><p>Score a group or follow the live match without score entry.</p></div><button className="watch-button" onClick={onView}><span>LIVE</span><strong>View leaderboard</strong><small>No scoring controls</small><i>→</i></button><p className="picker-divider">OR SCORE A GROUP</p><section>{groups.map(g=><button key={g.id} onClick={()=>onSelect(g.id)}><span>{g.type==='scramble'?'SCRAMBLE':'INDIVIDUAL'}</span><strong>{g.name}</strong><small>{g.type==='scramble'?'Emma · Stacey · Tracey':g.players.map(p=>p.name).join(' · ')}</small><i>→</i></button>)}</section><button className="organizer-link" onClick={onAdmin}>Organizer settings</button></main>}
function Scorecard({group,playerId,individual,onClose}){const player=individual&&group.type==='individual'?group.players.find(p=>p.id===playerId):null;const round=individual?(player?roundForPlayer(player,group):roundForScramble(group)):roundFor(group);const title=player?.name??group.name;return <div className="modal" role="dialog"><section><header><div><p className="eyebrow">{individual?'Individual round':'Team scorecard'}</p><h2>{title}</h2></div><button onClick={onClose}>×</button></header><div className="card-total"><strong>{round.thru?relative(round.toPar):'—'}</strong><span>Net · thru {round.thru}</span></div><div className={`scorecard-grid ${individual?'individual-card':''}`}><b>Hole</b><b>Par</b>{individual&&<b>Gross</b>}<b>{individual?'Net':'Team net'}</b>{holes.map((h,i)=>{const submitted=group.submittedHoles[i];const raw=player?.scores[i]??group.scores?.[i];const value=individual?(submitted?scoreNet(raw,player?.handicap??group.handicap,h):null):resultFor(group,i).value;return <div className="scorecard-row" key={h.number}><span>{h.number}</span><span>{h.par}</span>{individual&&<span>{submitted?(raw==='X'?'X':raw||'—'):'—'}</span>}<strong>{value??'—'}</strong></div>})}</div></section></div>}
function Admin({groups,setGroups,unlocked,onUnlock,onBack,onSave,onReset}){const [password,setPassword]=useState(''),[error,setError]=useState(false);const patchGroup=(id,patch)=>setGroups(gs=>gs.map(g=>g.id===id?{...g,...patch}:g));const unlock=e=>{e.preventDefault();if(password==='dutch')onUnlock();else setError(true)};return <main className="shell"><header><button className="back" onClick={onBack}>← Match</button><span className="brand">ORGANIZER</span></header><section className="unlock-panel">{unlocked?<><span>✓</span><div><strong>Editing unlocked</strong><p>Setup and round controls are enabled.</p></div></>:<form onSubmit={unlock}><div><strong>Want to make changes?</strong><p>Enter the organizer password to unlock.</p></div><input type="password" placeholder="Password" value={password} onChange={e=>{setPassword(e.target.value);setError(false)}}/><button>Unlock</button>{error&&<small>Incorrect password</small>}</form>}</section><section className="settings-head"><p className="eyebrow">Match setup</p><h1>Players & handicaps</h1><p>{unlocked?'Editing is unlocked.':'Visible to everyone · read-only until unlocked.'}</p></section><div className="settings">{groups.map(g=><section key={g.id}><label><span>Group name</span><input disabled={!unlocked} value={g.name} onChange={e=>patchGroup(g.id,{name:e.target.value})}/></label>{g.type==='scramble'?<label><span>Team handicap</span><input disabled={!unlocked} type="number" min="0" value={g.handicap} onChange={e=>patchGroup(g.id,{handicap:+e.target.value})}/></label>:g.players.map(p=><div className="player-setting" key={p.id}><input disabled={!unlocked} value={p.name} onChange={e=>patchGroup(g.id,{players:g.players.map(x=>x.id===p.id?{...x,name:e.target.value}:x)})}/><label><span>HCP</span><input disabled={!unlocked} type="number" min="0" value={p.handicap} onChange={e=>patchGroup(g.id,{players:g.players.map(x=>x.id===p.id?{...x,handicap:+e.target.value}:x)})}/></label></div>)}</section>)}<section className="danger"><h2>Reset scores</h2><p>Keep this setup and erase all submitted scores.</p><button disabled={!unlocked} onClick={()=>window.confirm('Erase every score and start a new round? This cannot be undone.')&&onReset()}>Start new round</button></section></div>{unlocked&&<div className="save"><button onClick={onSave}>Save match setup</button></div>}</main>}

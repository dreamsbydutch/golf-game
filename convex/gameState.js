import { mutation,query } from './_generated/server'
import { v } from 'convex/values'
const blanks=()=>Array(18).fill(''),unsubmitted=()=>Array(18).fill(false)
const DEFAULT_HOLES=[[4,5],[3,15],[4,17],[4,1],[4,9],[5,11],[4,13],[4,3],[3,7],[4,10],[3,18],[4,6],[4,2],[4,14],[4,16],[5,4],[3,12],[4,8]].map(([par,strokeIndex],index)=>({number:index+1,par,strokeIndex}))
const DEFAULT_GROUPS=[
	{id:'scramble',name:'Stace&Trace',type:'scramble',handicap:15,scores:blanks(),players:[],submittedHoles:unsubmitted()},
	{id:'group-a',name:'The Studs',type:'individual',players:[['A1','Andrew',10],['A2','Jack',8],['A3','Curtis',13]].map(([id,name,handicap])=>({id,name,handicap,scores:blanks()})),submittedHoles:unsubmitted()},
	{id:'group-b',name:'The Duffers',type:'individual',players:[['B1','Chris',20],['B2','Gibb',23],['B3','Mike',9],['B4','Scott',15]].map(([id,name,handicap])=>({id,name,handicap,scores:blanks()})),submittedHoles:unsubmitted()},
]
const playerV=v.object({id:v.string(),name:v.string(),handicap:v.number(),scores:v.array(v.string())})
const groupV=v.object({id:v.string(),name:v.string(),type:v.union(v.literal('scramble'),v.literal('individual')),handicap:v.optional(v.number()),scores:v.optional(v.array(v.string())),players:v.array(playerV),submittedHoles:v.array(v.boolean())})
const holeV=v.object({number:v.number(),par:v.number(),strokeIndex:v.number()})
const scores=value=>Array.from({length:18},(_,i)=>{const v=String(value?.[i]??'');return v==='X'||/^[1-9]$/.test(v)?v:''})
const flags=(value,fallbackScores)=>Array.from({length:18},(_,i)=>typeof value?.[i]==='boolean'?value[i]:Boolean(fallbackScores?.[i]))
function normalizeGroups(groups){
	if(!Array.isArray(groups)||!groups.some(g=>g.id==='scramble'))return structuredClone(DEFAULT_GROUPS)
	return DEFAULT_GROUPS.map(base=>{const old=groups.find(g=>g.id===base.id);if(!old)return base;if(base.type==='scramble'){const normalizedScores=scores(old.scores);return {...base,name:old.name||base.name,handicap:Number(old.handicap??15),scores:normalizedScores,submittedHoles:flags(old.submittedHoles,normalizedScores)}}const players=base.players.map(p=>{const x=old.players?.find(item=>item.id===p.id)||old.players?.find(item=>item.name===p.name);return x?{...p,name:x.name||p.name,handicap:Number(x.handicap??p.handicap),scores:scores(x.scores)}:p});return {...base,name:old.name||base.name,players,submittedHoles:flags(old.submittedHoles,players[0]?.scores)}})
}
const normalizeHoles=holes=>Array.isArray(holes)&&holes.length===18?holes.map((hole,index)=>({number:index+1,par:Math.max(3,Math.min(6,Number(hole.par)||DEFAULT_HOLES[index].par)),strokeIndex:Math.max(1,Math.min(18,Number(hole.strokeIndex)||DEFAULT_HOLES[index].strokeIndex))})):structuredClone(DEFAULT_HOLES)
const normalize=state=>({singletonKey:'main',groups:normalizeGroups(state?.groups),holes:normalizeHoles(state?.holes)})
async function ensure(ctx){const old=await ctx.db.query('gameState').first();if(old){const value=normalize(old);await ctx.db.replace(old._id,value);return {...value,_id:old._id}}const value=normalize();const id=await ctx.db.insert('gameState',value);return {...value,_id:id}}
export const get=query({args:{},handler:async ctx=>normalize(await ctx.db.query('gameState').first())})
export const submitGroupHole=mutation({
	args:{groupId:v.string(),holeIndex:v.number(),scores:v.array(v.string())},
	handler:async(ctx,args)=>{
		if(args.holeIndex<0||args.holeIndex>17)throw new Error('Invalid hole')
		const state=await ensure(ctx)
		const groups=state.groups.map(group=>{
			if(group.id!==args.groupId)return group
			const submittedHoles=[...group.submittedHoles]
			submittedHoles[args.holeIndex]=true
			if(group.type==='scramble'){
				const next=[...group.scores]
				next[args.holeIndex]=args.scores[0]||'X'
				return {...group,scores:next,submittedHoles}
			}
			return {...group,submittedHoles,players:group.players.map((player,i)=>{
				const next=[...player.scores]
				next[args.holeIndex]=args.scores[i]||'X'
				return {...player,scores:next}
			})}
		})
		await ctx.db.patch(state._id,{groups})
	},
})
export const saveSettings=mutation({args:{password:v.string(),groups:v.array(groupV),holes:v.array(holeV)},handler:async(ctx,args)=>{if(args.password!=='dutch')throw new Error('Unauthorized');const state=await ensure(ctx);const groups=state.groups.map(group=>{const incoming=args.groups.find(g=>g.id===group.id);if(!incoming)return group;if(group.type==='scramble')return {...group,name:incoming.name.trim()||group.name,handicap:Math.max(0,incoming.handicap??15)};return {...group,name:incoming.name.trim()||group.name,players:group.players.map(player=>{const p=incoming.players.find(x=>x.id===player.id);return p?{...player,name:p.name.trim()||player.name,handicap:Math.max(0,p.handicap)}:player})}});await ctx.db.patch(state._id,{groups,holes:normalizeHoles(args.holes)})}})
export const resetRound=mutation({args:{password:v.string()},handler:async(ctx,args)=>{if(args.password!=='dutch')throw new Error('Unauthorized');const state=await ensure(ctx);const groups=state.groups.map(group=>({...group,scores:group.type==='scramble'?blanks():group.scores,submittedHoles:unsubmitted(),players:group.players.map(player=>({...player,scores:blanks()}))}));await ctx.db.patch(state._id,{groups})}})

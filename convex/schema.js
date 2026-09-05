import { defineSchema,defineTable } from 'convex/server'
import { v } from 'convex/values'
const player=v.object({id:v.string(),name:v.string(),handicap:v.number(),scores:v.array(v.string())})
const group=v.object({id:v.string(),name:v.string(),type:v.union(v.literal('scramble'),v.literal('individual')),handicap:v.optional(v.number()),scores:v.optional(v.array(v.string())),players:v.array(player),submittedHoles:v.array(v.boolean())})
const hole=v.object({number:v.number(),par:v.number(),strokeIndex:v.number()})
export default defineSchema({gameState:defineTable({
	singletonKey:v.string(),
	groups:v.optional(v.array(group)),
	holes:v.optional(v.array(hole)),
	// Temporary migration fields from the previous Stableford game model.
	teams:v.optional(v.any()),
	players:v.optional(v.any()),
	stableford:v.optional(v.any()),
	currentHoleIndex:v.optional(v.number()),
})})

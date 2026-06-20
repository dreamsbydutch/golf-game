import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const playerValidator = v.object({
	id: v.number(),
	name: v.string(),
	tee: v.union(v.literal('blue'), v.literal('white')),
	handicap: v.string(),
	scores: v.array(v.string()),
})

const teamValidator = v.object({
	id: v.string(),
	name: v.string(),
	playerIds: v.array(v.number()),
})

const stablefordValidator = v.object({
	doubleBogeyOrWorse: v.number(),
	bogey: v.number(),
	par: v.number(),
	birdie: v.number(),
	eagleOrBetter: v.number(),
	lowestNetOnHole: v.number(),
	highestNetOnHole: v.number(),
})

export default defineSchema({
	gameState: defineTable({
		singletonKey: v.string(),
		teams: v.array(teamValidator),
		players: v.array(playerValidator),
		stableford: stablefordValidator,
		currentHoleIndex: v.number(),
	}),
})

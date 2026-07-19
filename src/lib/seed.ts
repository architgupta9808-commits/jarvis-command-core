import { addDays, formatISO, format, subDays } from 'date-fns';
import type { BrainNode, BrainNote, CalendarEvent, Task } from '@/types';

/**
 * Seed data: a densely but meaningfully connected second brain.
 * Edges come from [[wikilinks]] inside content — see lib/graph.ts.
 * Dates are generated relative to "now" so the demo always feels current.
 */

const now = new Date();
const iso = (d: Date) => formatISO(d);
const day = (offset: number) => format(addDays(now, offset), 'yyyy-MM-dd');

type SeedNode = Omit<BrainNode, 'createdAt' | 'updatedAt'> & { ageDays?: number; staleDays?: number };

const N = (n: SeedNode): BrainNode => ({
  ...n,
  createdAt: iso(subDays(now, n.ageDays ?? 60)),
  updatedAt: iso(subDays(now, n.staleDays ?? Math.min(n.ageDays ?? 60, 7))),
});

export function seedNodes(): BrainNode[] {
  return [
    /* ---------------- JEWELLERY BUSINESS ---------------- */
    N({
      id: 'biz-hub', title: 'Jewellery Business HQ', type: 'project', category: 'business', importance: 3, pinned: true,
      tags: ['business', 'strategy'], ageDays: 400, staleDays: 1,
      content: `# Jewellery Business HQ\n\nCentral command for the retail jewellery operation — five showrooms across the city.\n\n## Active fronts\n- [[Store Expansion Plan]] — sixth location scouting\n- [[Inventory Intelligence]] — sludge & fast-mover analytics\n- [[Festive Season Campaign]] — Q3 marketing push\n- [[Staff Incentive Redesign]] — new slab structure rollout\n\n## People\n- [[Regional Manager - Priya]] runs day-to-day across stores\n- Weekly ops review every Monday 10:00\n\n> Principle: inventory turns beat gross margin. Watch the slow movers. #business #retail`,
    }),
    N({
      id: 'biz-expansion', title: 'Store Expansion Plan', type: 'project', category: 'business', importance: 3,
      tags: ['business', 'expansion'], ageDays: 120, staleDays: 3,
      content: `# Store Expansion Plan\n\nEvaluating a sixth showroom. Two candidate micro-markets shortlisted.\n\n- Footfall study commissioned — results due end of month\n- CapEx envelope: conservative, funded from [[Jewellery Business HQ]] cash flows\n- Learnings doc: [[Showroom Launch Playbook]]\n- Risk: cannibalising the flagship's catchment. [[Regional Manager - Priya]] disagrees — her data says < 8% overlap.\n\n#business #expansion`,
    }),
    N({
      id: 'biz-inventory', title: 'Inventory Intelligence', type: 'project', category: 'business', importance: 3,
      tags: ['business', 'inventory', 'analytics'], ageDays: 90, staleDays: 2,
      content: `# Inventory Intelligence\n\nData-driven stock management across all five stores.\n\n## Findings\n- ~18% of stock qualifies as **sludge** (no sale in 180+ days)\n- Fast movers concentrate in lightweight daily-wear — under-indexed at two stores\n- Solitaire velocity up 30% YoY\n\n## Actions\n- Monthly sludge exchange with vendors\n- Rebalance transfers between stores before [[Festive Season Campaign]]\n- Dashboard idea folded into [[AI Ops Copilot]]\n\n#inventory #analytics`,
    }),
    N({
      id: 'biz-campaign', title: 'Festive Season Campaign', type: 'project', category: 'business', importance: 2,
      tags: ['business', 'marketing'], ageDays: 45, staleDays: 4,
      content: `# Festive Season Campaign\n\nQ3 festive push across all stores.\n\n- Theme: "Heirlooms in the making"\n- Channels: local influencers, radio, in-mall activations, WhatsApp broadcast to repeat customers\n- Exchange-melt offer for old gold — historically the #1 traffic driver\n- Creative review with agency — see [[Brand Refresh Moodboard]]\n- Tie-in: [[Staff Incentive Redesign]] boosters during campaign weeks\n\n#marketing #festive`,
    }),
    N({
      id: 'biz-incentive', title: 'Staff Incentive Redesign', type: 'project', category: 'business', importance: 2,
      tags: ['business', 'people'], ageDays: 70, staleDays: 6,
      content: `# Staff Incentive Redesign\n\nNew per-piece slab incentive structure for showroom staff.\n\n- Four earning categories with slab rate cards\n- Eligibility gate keeps focus on volume + quality\n- Anti-collusion checks in the payout engine\n- Rollout: pilot at flagship, then all stores. [[Regional Manager - Priya]] owns comms.\n\n#people #incentives`,
    }),
    N({
      id: 'biz-playbook', title: 'Showroom Launch Playbook', type: 'note', category: 'business', importance: 2,
      tags: ['business', 'playbook'], ageDays: 300, staleDays: 40,
      content: `# Showroom Launch Playbook\n\nEverything learned from the last two launches.\n\n1. Sign lease → fit-out is always 2x the quoted timeline\n2. Hire the store manager 90 days before opening\n3. Opening-week exchange offer beats discounting\n4. Local temple + community relationships matter more than ads\n\nFeeds [[Store Expansion Plan]]. #playbook`,
    }),
    N({
      id: 'biz-priya', title: 'Regional Manager - Priya', type: 'person', category: 'business', importance: 2,
      tags: ['people', 'team'], ageDays: 350, staleDays: 5,
      content: `# Priya — Regional Manager\n\nRuns daily operations across all five stores. 11 years in jewellery retail.\n\n- Strengths: floor discipline, vendor negotiation, staff loyalty\n- Watch: stretched thin — needs a deputy before [[Store Expansion Plan]] executes\n- Driving [[Staff Incentive Redesign]] rollout comms\n\n#team`,
    }),
    N({
      id: 'biz-brand', title: 'Brand Refresh Moodboard', type: 'idea', category: 'business', importance: 1,
      tags: ['marketing', 'design'], ageDays: 30, staleDays: 12,
      content: `# Brand Refresh Moodboard\n\nModernise without losing trust equity.\n\n- Deep green + gold palette, serif wordmark\n- Photography: real families, heirloom stories — not catalogue shots\n- Applies to [[Festive Season Campaign]] creatives first\n\n#design #brand`,
    }),
    N({
      id: 'biz-whatsapp', title: 'WhatsApp Commerce Channel', type: 'idea', category: 'business', importance: 2,
      tags: ['business', 'digital'], ageDays: 25, staleDays: 9,
      content: `# WhatsApp Commerce Channel\n\nRepeat customers ask for new-arrival photos constantly — formalise it.\n\n- Broadcast lists per store, opt-in at billing\n- Catalogue + book-a-visit flow\n- Staff protocol so it doesn't die after week two\n- Could share rails with [[AI Ops Copilot]]\n\n#digital #whatsapp`,
    }),

    /* ---------------- MUSIC PRODUCTION ---------------- */
    N({
      id: 'mus-hub', title: 'Music Production Journey', type: 'project', category: 'music', importance: 3, pinned: true,
      tags: ['music', 'edm', 'creative'], ageDays: 200, staleDays: 2,
      content: `# Music Production Journey\n\nThe long game: produce and release melodic techno / progressive house.\n\n- DAW: [[Ableton Live Mastery]] — currently deep in sound design\n- Rig: [[Portable Studio Rig]] for hotel-room sessions while travelling\n- WIP: [[Track - Midnight Meridian]] and [[Track - Monsoon Circuit]]\n- Learning: [[Sound Design Vault]], weekly analysis of reference tracks\n- Dream: play a sunset set in [[Bali Scouting Trip]] territory\n\n#music #edm`,
    }),
    N({
      id: 'mus-ableton', title: 'Ableton Live Mastery', type: 'note', category: 'music', importance: 2,
      tags: ['music', 'ableton', 'learning'], ageDays: 180, staleDays: 3,
      content: `# Ableton Live Mastery\n\nStructured path through Live 12.\n\n- ✅ Session vs arrangement workflow\n- ✅ Drum racks, simpler/sampler\n- 🔄 Operator FM synthesis — see [[Sound Design Vault]]\n- ⏳ Max for Live devices\n\nPractice loop: one finished 8-bar idea per day, no exceptions. #ableton`,
    }),
    N({
      id: 'mus-rig', title: 'Portable Studio Rig', type: 'note', category: 'music', importance: 2,
      tags: ['music', 'gear'], ageDays: 60, staleDays: 8,
      content: `# Portable Studio Rig\n\nHotel-room-ready setup for producing on the road.\n\n- MacBook Pro + Live 12\n- Audient iD4 interface, DT 770 Pro headphones\n- AKAI MPK Mini for sketching\n- Everything fits carry-on for [[Europe Trip 2026]] and [[Bali Scouting Trip]]\n\n#gear #travel`,
    }),
    N({
      id: 'mus-track1', title: 'Track - Midnight Meridian', type: 'project', category: 'music', importance: 2,
      tags: ['music', 'wip'], ageDays: 40, staleDays: 1,
      content: `# Track — Midnight Meridian\n\nMelodic techno, 122 BPM, F minor.\n\n- ✅ Chord progression + bassline\n- 🔄 Breakdown needs a stronger lead — try Operator patch from [[Sound Design Vault]]\n- ⏳ Arrangement to 6 min, then mixdown\n- Reference: Anyma, Ben Böhmer live sets\n\n#wip`,
    }),
    N({
      id: 'mus-track2', title: 'Track - Monsoon Circuit', type: 'project', category: 'music', importance: 1,
      tags: ['music', 'wip'], ageDays: 15, staleDays: 15,
      content: `# Track — Monsoon Circuit\n\nProgressive house sketch born during a rainy-evening session.\n\n- Field recording of monsoon rain as texture layer\n- Needs: drop design, second act\n- Parked while [[Track - Midnight Meridian]] finishes\n\n#wip`,
    }),
    N({
      id: 'mus-sound', title: 'Sound Design Vault', type: 'note', category: 'music', importance: 2,
      tags: ['music', 'sound-design'], ageDays: 100, staleDays: 4,
      content: `# Sound Design Vault\n\nPatch recipes and synthesis notes.\n\n- Operator: FM pluck → feeds [[Track - Midnight Meridian]] lead search\n- Wavetable: evolving pad with slow LFO on wt-position\n- Resampling workflow for texture beds\n- Study queue: serum-style growls, analog-style drift\n\n#sound-design`,
    }),
    N({
      id: 'mus-release', title: 'EP Release Strategy', type: 'idea', category: 'music', importance: 1,
      tags: ['music', 'release'], ageDays: 20, staleDays: 18,
      content: `# EP Release Strategy\n\nWhen 3 tracks are finished:\n\n- 3-track EP, self-release on streaming + Bandcamp\n- One label shortlist for the strongest track\n- Visuals: hire motion designer, tie to [[Brand Refresh Moodboard]] aesthetic learnings\n- First candidates: [[Track - Midnight Meridian]], [[Track - Monsoon Circuit]]\n\n#release`,
    }),

    /* ---------------- HEALTH ---------------- */
    N({
      id: 'hlt-hub', title: 'Health Optimization Protocol', type: 'project', category: 'health', importance: 3, pinned: true,
      tags: ['health', 'fitness'], ageDays: 150, staleDays: 1,
      content: `# Health Optimization Protocol\n\nOperating system for energy and longevity.\n\n- Training: [[Strength Training Program]] 4x/week\n- Sleep: [[Sleep Architecture]] — non-negotiable 23:00 lights out\n- Fuel: [[Nutrition Framework]]\n- Quarterly bloodwork panel — next one due soon\n- Travel protocol: hotel gym minimum viable workout, see [[Europe Trip 2026]]\n\n#health`,
    }),
    N({
      id: 'hlt-strength', title: 'Strength Training Program', type: 'note', category: 'health', importance: 2,
      tags: ['health', 'gym'], ageDays: 150, staleDays: 2,
      content: `# Strength Training Program\n\nUpper/lower split, 4 sessions/week, morning slots.\n\n- Progressive overload log in gym app\n- Current: squat 100kg 5x5, bench 75kg 5x5\n- Deload every 6th week\n- Protein target from [[Nutrition Framework]]: 140g/day\n\n#gym`,
    }),
    N({
      id: 'hlt-sleep', title: 'Sleep Architecture', type: 'note', category: 'health', importance: 2,
      tags: ['health', 'sleep'], ageDays: 90, staleDays: 10,
      content: `# Sleep Architecture\n\n- 23:00–06:30 window, phone outside bedroom\n- Evening studio sessions ([[Music Production Journey]]) must end by 22:15\n- Caffeine cutoff 14:00\n- Tracking: consistent 7h+ correlates with best showroom decision days\n\n#sleep`,
    }),
    N({
      id: 'hlt-nutrition', title: 'Nutrition Framework', type: 'note', category: 'health', importance: 1,
      tags: ['health', 'nutrition'], ageDays: 120, staleDays: 30,
      content: `# Nutrition Framework\n\n- Protein-first plates, 140g/day target\n- Home-cooked default; restaurant rule: order protein + greens first\n- Festive season is the danger zone — plan ahead for [[Festive Season Campaign]] weeks\n- Hydration: 3L/day\n\n#nutrition`,
    }),

    /* ---------------- TRAVEL ---------------- */
    N({
      id: 'trv-hub', title: 'Travel Masterplan', type: 'project', category: 'travel', importance: 2, pinned: true,
      tags: ['travel', 'luxury'], ageDays: 100, staleDays: 3,
      content: `# Travel Masterplan\n\nTravel as fuel: rest, inspiration, sound.\n\n- [[Europe Trip 2026]] — the big one, 20 days\n- [[Bali Scouting Trip]] — villa + studio month concept\n- [[Africa Safari Dream]] — someday/maybe, keep researching\n- Rule: every trip carries the [[Portable Studio Rig]]\n\n#travel`,
    }),
    N({
      id: 'trv-europe', title: 'Europe Trip 2026', type: 'project', category: 'travel', importance: 3,
      tags: ['travel', 'europe'], ageDays: 80, staleDays: 1,
      content: `# Europe Trip 2026\n\n20 days across Amsterdam + Italy, anchored around the Dutch GP weekend.\n\n## Status\n- ✅ Flights booked\n- 🔄 Hotels: Amalfi coast pending — prices rising, book this week\n- 🔄 Train legs: Amsterdam→Milan sleeper vs fly\n- ⏳ Dutch GP grandstand tickets — release date watch\n\n## Threads\n- Music: hotel sessions with [[Portable Studio Rig]], scout Amsterdam record stores\n- Health: [[Health Optimization Protocol]] travel protocol applies\n- Family: [[Family Time Design]] — parents join the Italy leg\n\n#europe #travel`,
    }),
    N({
      id: 'trv-bali', title: 'Bali Scouting Trip', type: 'idea', category: 'travel', importance: 2,
      tags: ['travel', 'bali', 'music'], ageDays: 55, staleDays: 20,
      content: `# Bali Scouting Trip\n\nConcept: one month, villa in Ubud or Uluwatu, mornings for [[Music Production Journey]], afternoons exploring.\n\n- Villa shortlist with dedicated workspace\n- Sunset venues that book emerging DJs — the [[EP Release Strategy]] unlock\n- Timing: post-festive season lull\n\n#bali`,
    }),
    N({
      id: 'trv-africa', title: 'Africa Safari Dream', type: 'idea', category: 'travel', importance: 1,
      tags: ['travel', 'africa'], ageDays: 200, staleDays: 60,
      content: `# Africa Safari Dream\n\nSomeday/maybe: Serengeti migration + Cape Town double.\n\n- Best window: July–September for the crossing\n- Combine with [[Family Time Design]] — parents' 40th anniversary idea\n- Budget class: fly-in camps, 10 days\n\n#africa #someday`,
    }),

    /* ---------------- FAMILY & PERSONAL ---------------- */
    N({
      id: 'fam-hub', title: 'Family Time Design', type: 'project', category: 'family', importance: 3,
      tags: ['family'], ageDays: 90, staleDays: 5,
      content: `# Family Time Design\n\nDeliberate architecture for family presence — not leftovers.\n\n- Sunday lunch: sacred, no phone\n- Parents joining the Italy leg of [[Europe Trip 2026]]\n- Anniversary idea brewing: [[Africa Safari Dream]]\n- Teach cousin the business — shadow days at the flagship, coordinate with [[Regional Manager - Priya]]\n\n#family`,
    }),
    N({
      id: 'fam-home', title: 'Home Studio Corner', type: 'project', category: 'personal', importance: 1,
      tags: ['home', 'music'], ageDays: 35, staleDays: 25,
      content: `# Home Studio Corner\n\nConvert the spare room corner into a permanent production nook.\n\n- Acoustic panels x6, corner bass traps\n- Desk with monitor isolation pads\n- Everything from [[Portable Studio Rig]] docks here when home\n\n#home`,
    }),
    N({
      id: 'per-reading', title: 'Reading Pipeline', type: 'note', category: 'personal', importance: 1,
      tags: ['reading', 'learning'], ageDays: 60, staleDays: 14,
      content: `# Reading Pipeline\n\n- *The Psychology of Money* — reread, annotate for [[Wealth Architecture]]\n- *Shoe Dog* — retail obsession fuel for [[Jewellery Business HQ]]\n- *Effortless Mastery* (Kenny Werner) — mindset for [[Music Production Journey]]\n\n#reading`,
    }),
    N({
      id: 'per-wealth', title: 'Wealth Architecture', type: 'note', category: 'personal', importance: 2,
      tags: ['finance', 'strategy'], ageDays: 110, staleDays: 35,
      content: `# Wealth Architecture\n\nPersonal capital allocation principles.\n\n- Business reinvestment first ([[Store Expansion Plan]] gets priority)\n- Index SIPs on autopilot\n- Real estate: only if it houses a store\n- Annual review each April\n\n#finance`,
    }),

    /* ---------------- BIG IDEAS ---------------- */
    N({
      id: 'idea-copilot', title: 'AI Ops Copilot', type: 'idea', category: 'ideas', importance: 3,
      tags: ['ai', 'business', 'product'], ageDays: 30, staleDays: 2,
      content: `# AI Ops Copilot\n\nBig idea: an AI layer over the jewellery business.\n\n- Daily briefing from sales + [[Inventory Intelligence]] data\n- Voice-first for the shop floor — staff ask, it answers\n- WhatsApp delivery via [[WhatsApp Commerce Channel]] rails\n- This very app ([[JARVIS Command Core]]) is the personal prototype\n\n#ai #product`,
    }),
    N({
      id: 'idea-jarvis', title: 'JARVIS Command Core', type: 'project', category: 'ideas', importance: 3,
      tags: ['ai', 'product', 'second-brain'], ageDays: 10, staleDays: 0,
      content: `# JARVIS Command Core\n\nThe personal AI operating system — this app.\n\n- God's Eye: 3D second brain\n- Operations: planner + briefings\n- Voice command layer with LLM categorisation\n- Obsidian as the durable storage layer\n- Sibling idea: [[AI Ops Copilot]] for the business\n\n#second-brain #ai`,
    }),
    N({
      id: 'idea-academy', title: 'Retail Academy Concept', type: 'idea', category: 'ideas', importance: 1,
      tags: ['business', 'education'], ageDays: 75, staleDays: 50,
      content: `# Retail Academy Concept\n\nTrain jewellery retail staff at scale — internal first, product later.\n\n- Curriculum from [[Showroom Launch Playbook]] + floor SOPs\n- Video modules + WhatsApp micro-lessons\n- Ties into [[Staff Incentive Redesign]] certification gates\n\n#education #someday`,
    }),
    N({
      id: 'idea-podcast', title: 'Family Business Podcast', type: 'idea', category: 'ideas', importance: 1,
      tags: ['content', 'someday'], ageDays: 45, staleDays: 45,
      content: `# Family Business Podcast\n\nConversations with second-gen owners modernising traditional businesses.\n\n- Episode 0 outline drafted\n- Overlaps: [[Jewellery Business HQ]] stories, [[Retail Academy Concept]] audience\n- Parked until [[EP Release Strategy]] ships — one creative launch at a time\n\n#someday`,
    }),
    N({
      id: 'per-morning', title: 'Morning Protocol', type: 'note', category: 'personal', importance: 2,
      tags: ['routine', 'health'], ageDays: 130, staleDays: 6,
      content: `# Morning Protocol\n\n06:30 wake → sunlight + water → gym ([[Strength Training Program]]) → 20 min review of this system → showroom rounds.\n\nProtect the first 90 minutes. No email before 09:00. Links: [[Sleep Architecture]], [[Health Optimization Protocol]].\n\n#routine`,
    }),
    N({
      id: 'biz-vendor', title: 'Vendor Network Map', type: 'note', category: 'business', importance: 2,
      tags: ['business', 'vendors'], ageDays: 160, staleDays: 22,
      content: `# Vendor Network Map\n\nKey manufacturing + supply relationships.\n\n- Lightweight daily-wear: two karigar workshops, 3-week lead\n- Solitaires: certified supplier, memo terms\n- Sludge exchange partners — critical for [[Inventory Intelligence]] hygiene\n- Renegotiate making charges before [[Festive Season Campaign]]\n\n#vendors`,
    }),
    N({
      id: 'mus-analysis', title: 'Reference Track Analysis', type: 'note', category: 'music', importance: 1,
      tags: ['music', 'learning'], ageDays: 50, staleDays: 11,
      content: `# Reference Track Analysis\n\nWeekly deep-listen ritual — deconstruct one great track.\n\n- Log: arrangement map, sound palette, energy curve\n- Current: Ben Böhmer — *Beyond Beliefs*\n- Insights feed [[Sound Design Vault]] and [[Track - Midnight Meridian]]\n\n#learning`,
    }),
    N({
      id: 'trv-amsterdam', title: 'Amsterdam Itinerary Notes', type: 'note', category: 'travel', importance: 1,
      tags: ['travel', 'europe'], ageDays: 21, staleDays: 7,
      content: `# Amsterdam Itinerary Notes\n\nPart of [[Europe Trip 2026]].\n\n- Dutch GP weekend at Zandvoort — train from Amsterdam Centraal\n- Record stores: Rush Hour, Red Light Records — sample-hunting for [[Sound Design Vault]]\n- Canal-side morning runs per [[Health Optimization Protocol]]\n\n#europe`,
    }),
    N({
      id: 'fam-cousin', title: 'Cousin Mentorship Track', type: 'note', category: 'family', importance: 1,
      tags: ['family', 'business'], ageDays: 40, staleDays: 16,
      content: `# Cousin Mentorship Track\n\nBring the next generation into the business deliberately.\n\n- Month 1: floor shadowing at flagship with [[Regional Manager - Priya]]\n- Month 2: inventory basics via [[Inventory Intelligence]]\n- Month 3: own a small counter P&L\n- Part of [[Family Time Design]]\n\n#mentorship`,
    }),
    N({
      id: 'hlt-bloodwork', title: 'Quarterly Bloodwork Panel', type: 'task', category: 'health', importance: 2,
      tags: ['health', 'labs'], ageDays: 85, staleDays: 13,
      content: `# Quarterly Bloodwork Panel\n\nStanding health audit — part of [[Health Optimization Protocol]].\n\n- Panel: lipids, HbA1c, vitamin D, thyroid, testosterone\n- Book fasting slot before 08:00, results into tracking sheet\n- Flag anything drifting to Dr. Mehta\n\n#labs`,
    }),
  ];
}

export function seedTasks(): Task[] {
  const t = (p: Partial<Task> & { id: string; title: string }): Task => ({
    done: false,
    priority: 'normal',
    category: 'personal',
    createdAt: iso(subDays(now, 3)),
    ...p,
  });
  return [
    t({ id: 't1', title: 'Book Amalfi coast hotel before prices rise', priority: 'critical', category: 'travel', due: day(2), linkedNodeId: 'trv-europe' }),
    t({ id: 't2', title: 'Review footfall study for sixth store', priority: 'high', category: 'business', due: day(1), linkedNodeId: 'biz-expansion' }),
    t({ id: 't3', title: 'Approve festive campaign creatives', priority: 'high', category: 'business', due: day(0), linkedNodeId: 'biz-campaign' }),
    t({ id: 't4', title: 'Finish Midnight Meridian breakdown lead', priority: 'high', category: 'music', due: day(3), linkedNodeId: 'mus-track1', scheduled: { date: day(0), startMin: 14 * 60, durationMin: 120 } }),
    t({ id: 't5', title: 'Book quarterly bloodwork slot', priority: 'normal', category: 'health', due: day(4), linkedNodeId: 'hlt-bloodwork' }),
    t({ id: 't6', title: 'Sludge exchange list to vendors', priority: 'high', category: 'business', due: day(1), linkedNodeId: 'biz-inventory' }),
    t({ id: 't7', title: 'Dutch GP grandstand tickets — check release', priority: 'normal', category: 'travel', due: day(5), linkedNodeId: 'trv-europe' }),
    t({ id: 't8', title: 'Order acoustic panels for studio corner', priority: 'low', category: 'personal', linkedNodeId: 'fam-home' }),
    t({ id: 't9', title: 'Draft incentive rollout note with Priya', priority: 'normal', category: 'business', due: day(2), linkedNodeId: 'biz-incentive' }),
    t({ id: 't10', title: 'Weekly reference track deep-listen', priority: 'low', category: 'music', linkedNodeId: 'mus-analysis' }),
    t({ id: 't11', title: 'Renegotiate making charges with karigar workshop', priority: 'normal', category: 'business', due: day(8), linkedNodeId: 'biz-vendor' }),
    t({ id: 't12', title: 'Shortlist Ubud villas with workspace', priority: 'low', category: 'travel', linkedNodeId: 'trv-bali' }),
    t({ id: 't13', title: 'Sunday lunch — fully offline', priority: 'high', category: 'family', due: day(1), linkedNodeId: 'fam-hub' }),
    t({ id: 't14', title: 'Update wealth allocation sheet', priority: 'low', category: 'personal', due: day(12), linkedNodeId: 'per-wealth' }),
  ];
}

export function seedNotes(): BrainNote[] {
  const n = (p: Omit<BrainNote, 'id' | 'createdAt'> & { age?: number }): BrainNote => ({
    ...p,
    id: `sn-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    createdAt: iso(subDays(now, p.age ?? 2)),
  });
  return [
    n({
      title: 'Festive campaign launch', format: 'todo', category: 'business', age: 1, nodeId: 'biz-campaign',
      body: '',
      items: [
        { text: 'Approve hero creatives', done: true },
        { text: 'Radio spot booking', done: true },
        { text: 'WhatsApp broadcast copy', done: false },
        { text: 'Exchange-melt signage', done: false },
      ],
    }),
    n({
      title: 'No sixth store until the math is proven', format: 'commitment', category: 'business', age: 7, nodeId: 'biz-expansion',
      body: 'No new store until the sixth one’s footfall math is proven.',
    }),
    n({
      title: 'Karigar renegotiation angles', format: 'note', category: 'business', age: 3, nodeId: 'biz-vendor',
      body: 'Lead with volume guarantee, then payment terms. Making charges last — never open with them.',
    }),
    n({
      title: 'Breakdown lead idea', format: 'note', category: 'music', age: 1, nodeId: 'mus-track1',
      body: 'Detune the FM pluck −12c, print through tape saturation, ride the filter into the drop.',
    }),
    n({
      title: 'Reference deep-listen ritual', format: 'reminder', category: 'music', age: 2, nodeId: 'mus-analysis',
      body: 'Ben Böhmer — Beyond Beliefs. Arrangement map + energy curve.',
      remindAt: `${day(1)} 22:00`,
    }),
    n({
      title: 'Bloodwork — fasting slot', format: 'reminder', category: 'health', age: 2, nodeId: 'hlt-bloodwork',
      body: 'Full panel. Book before 8 AM, results into the tracking sheet.',
      remindAt: `${day(3)} 07:30`,
    }),
    n({
      title: 'Lights out by 23:00', format: 'commitment', category: 'health', age: 17, nodeId: 'hlt-sleep',
      body: 'Lights out by 23:00 on weeknights. The studio can wait for the weekend.',
    }),
    n({
      title: 'Lock the Italy leg', format: 'todo', category: 'travel', age: 4, nodeId: 'trv-europe',
      body: '',
      items: [
        { text: 'Flights booked', done: true },
        { text: 'Rome hotel', done: true },
        { text: 'Amalfi hotel — prices rising', done: false },
        { text: 'GP grandstand tickets', done: false },
      ],
    }),
    n({
      title: 'Sunday lunch — fully offline', format: 'reminder', category: 'family', age: 1, nodeId: 'fam-hub',
      body: 'Phone in the drawer. Non-negotiable.',
      remindAt: `${day(1)} 13:00`,
    }),
  ];
}

export function seedEvents(): CalendarEvent[] {
  return [
    { id: 'e1', title: 'Showroom rounds — flagship + city store', date: day(0), startMin: 10 * 60, durationMin: 120, category: 'business' },
    { id: 'e2', title: 'Music production block', date: day(0), startMin: 14 * 60, durationMin: 120, category: 'music', protected: true, linkedNodeId: 'mus-track1' },
    { id: 'e3', title: 'Gym — upper body', date: day(0), startMin: 7 * 60, durationMin: 75, category: 'health', protected: true },
    { id: 'e4', title: 'Weekly ops review with Priya', date: day(1), startMin: 10 * 60, durationMin: 60, category: 'business', linkedNodeId: 'biz-priya' },
    { id: 'e5', title: 'Sunday family lunch', date: day(1), startMin: 13 * 60, durationMin: 120, category: 'family', protected: true, linkedNodeId: 'fam-hub' },
    { id: 'e6', title: 'Gym — lower body', date: day(1), startMin: 7 * 60, durationMin: 75, category: 'health', protected: true },
    { id: 'e7', title: 'Agency call — festive creatives', date: day(2), startMin: 16 * 60, durationMin: 45, category: 'business', linkedNodeId: 'biz-campaign' },
    { id: 'e8', title: 'Vendor visit — solitaire supplier', date: day(3), startMin: 11 * 60, durationMin: 90, category: 'business', linkedNodeId: 'biz-vendor' },
    { id: 'e9', title: 'Music production block', date: day(2), startMin: 14 * 60, durationMin: 120, category: 'music', protected: true },
    { id: 'e10', title: 'Gym — upper body', date: day(3), startMin: 7 * 60, durationMin: 75, category: 'health', protected: true },
  ];
}

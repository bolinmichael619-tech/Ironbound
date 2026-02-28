import { NARRATIVE_INDEX } from './narrativeLibrary.js';

export const DEITIES = {
  flame: { name: 'The Flame', domain: 'Purification', color: '#c84020' },
  war: { name: 'The Iron Crown', domain: 'Conquest', color: '#8a2020' },
  harvest: { name: 'The Green Mother', domain: 'Growth', color: '#3a8a20' },
  sea: { name: 'The Deep', domain: 'Depth', color: '#205a8a' },
  decay: { name: 'The Rot', domain: 'Decay', color: '#4a3a20' },
  shadow: { name: 'The Veil', domain: 'Secrets', color: '#2a2a3a' },
  storm: { name: 'The Gale', domain: 'Sky', color: '#6070a0' },
  stone: { name: 'The Mountain', domain: 'Endurance', color: '#6a6a5a' }
};

export const PROVINCE_CLASSES = [
  'River Valley', 'Coastal Port', 'Highland Bastion', 'Desert Basin', 'Swamp Marsh',
  'Frontier Wild', 'Trade Hub', 'Imperial Core', 'Mountain Pass', 'Pirate Coast',
  'Ruined Kingdom', 'Holy Sanctuary', 'Arcane Nexus', 'Undead Blight', 'Beast Dominion',
  'Cataclysm Scar', 'Salt Steppe', 'Blackwood', 'Ash March'
];

export const RESOURCES = [
  'Grain', 'Timber', 'Iron', 'Stone', 'Livestock', 'Salt', 'Silver',
  'Arcane Reagent', 'Faith Relic', 'Exotic Trade'
];

export const RACES_WORLD = {
  imperial: { name: 'Imperial Legates', culture: 'imperial', traits: ['disciplined', 'political'] },
  river_prince: { name: 'River Principalities', culture: 'riverfolk', traits: ['mercantile', 'fractious'] },
  marcher: { name: 'High Marcher Houses', culture: 'marcher', traits: ['militant', 'proud'] },
  nomad: { name: 'Salt Steppe Nomads', culture: 'steppe', traits: ['mobile', 'raiding'] },
  freeport: { name: 'Blackshore Free Cities', culture: 'coastal', traits: ['trade', 'piracy'] },
  canopy: { name: 'High Canopy Courts', culture: 'elven', traits: ['ancient', 'isolationist'] },
  thorn: { name: 'Thorn Exiles', culture: 'elven_exile', traits: ['bitter', 'skilled'] },
  glass: { name: 'Glass Scholars', culture: 'elven_arcane', traits: ['arcane', 'fragile'] },
  deephold: { name: 'Deep Holds', culture: 'dwarven', traits: ['mining', 'fortress'] },
  gatewarden: { name: 'Gate Wardens', culture: 'dwarven_martial', traits: ['militant', 'stoic'] },
  ashforged: { name: 'Ashforged Clans', culture: 'dwarven_industrial', traits: ['industry', 'siege'] },
  fenfolk: { name: 'Fen Clans', culture: 'beast_swamp', traits: ['poison', 'ambush'] },
  horned: { name: 'Horned Steppe', culture: 'beast_plains', traits: ['cavalry', 'raiding'] },
  totemist: { name: 'Blackwood Totemists', culture: 'beast_forest', traits: ['shamanic', 'territorial'] },
  aurelian: { name: 'Aurelian Remnant', culture: 'fallen_light', traits: ['faith_engine', 'schism_prone'] },
  cinderborn: { name: 'Cinderborn', culture: 'ashland', traits: ['industrial', 'siege', 'unrest_if_trade_breaks'] },
  thalassid: { name: 'Thalassid', culture: 'deepwater', traits: ['sea_trade', 'cult_risk'] }
};

export const CULTURE_NAMES = {
  imperial: { first: ['Aldric', 'Varen', 'Cassian', 'Marcellus', 'Theodric', 'Lysara', 'Helena', 'Octavian', 'Severina', 'Lucan'], house: ['Varnoth', 'Steelhart', 'Ashford', 'Blackmere', 'Ironhold', 'Grenthas', 'Valdric'] },
  riverfolk: { first: ['Willem', 'Arna', 'Tobias', 'Maren', 'Haldric', 'Petra', 'Osmund', 'Lira'], house: ['van Rijn', 'Millward', 'Stonebridge', 'Fernhollow'] },
  marcher: { first: ['Rowan', 'Gareth', 'Isolde', 'Cormac', 'Brynn', 'Edric', 'Moira'], house: ['Greymane', 'Blackthorn', 'Ironwood', 'Ashwick', 'Ravenscar'] },
  steppe: { first: ['Ghan', 'Yruk', 'Sarai', 'Temur', 'Bolga', 'Kessa', 'Arjun'], house: ['Salt Wind', 'Red Horse', 'Bone Plains'] },
  coastal: { first: ['Corso', 'Vela', 'Nikos', 'Tessa', 'Renzo', 'Mira', 'Sable'], house: ['Blackshore', 'Tideharbor', 'Sablewake'] },
  elven: { first: ['Thalindra', 'Aelwin', 'Caelith', 'Seraphel', 'Lindorin', 'Mythara'], house: ['Silver Bough', 'Moonveil', 'Starweaver'] },
  dwarven: { first: ['Durin', 'Brokka', 'Thrain', 'Hilda', 'Grimjaw', 'Agna', 'Torvek'], house: ['Ironvein', 'Stonemantle', 'Deepfire', 'Hammerfall'] },
  beast: { first: ['Grakk', 'Thokka', 'Snarl', 'Mirefoot', 'Ashfang', 'Nakkra', 'Urgash'], house: ['Howler', 'Bonegnawer', 'Mudwalker', 'Treesplitter'] },
  fallen_light: { first: ['Solarius', 'Auriel', 'Luminara', 'Vestian', 'Radienne'], house: ['Dying Sun', 'Lightfall', 'Dawnshatter'] },
  ashland: { first: ['Kael', 'Smeltra', 'Forge', 'Cinder', 'Brassica', 'Vulkan'], house: ['Ashborn', 'Ironlung', 'Slagheap', 'Cinderfist'] },
  deepwater: { first: ['Thaloss', 'Nereia', 'Coralline', 'Pelagius', 'Abyssia'], house: ['Deepcurrent', 'Tidesinger', 'Shellthrone'] }
};

export const MONSTER_BIOME = {
  forest: ['Thorn Wolves', 'Wyrd Stag', 'Briar Witch'],
  swamp: ['Mire Colossus', 'Leech Cult', 'Fen Serpent'],
  mountain: ['Stone Eater', 'Harpy Court', 'Frostbound Giant'],
  plains: ['Bone Riders', 'Stampede Beast', 'Sand Wraith'],
  coast: ['Drowners', 'Pirate King', 'Leviathan Spawn'],
  ruins: ['Mirror Knight', 'Living Sigil', 'Hollow Choir']
};

export const APEX_ROSTER = [
  { type: 'Ancient Dragon', lair: 'mountain', rarity: 0.3 },
  { type: 'Demon Prince', lair: 'corrupted', rarity: 0.15 },
  { type: 'Titan Beast', lair: 'wasteland', rarity: 0.1 },
  { type: 'Lich Regent', lair: 'ruins', rarity: 0.2 },
  { type: 'Leviathan', lair: 'coast', rarity: 0.1 },
  { type: 'The Black Hart', lair: 'forest', rarity: 0.1 },
  { type: 'The Ash Seraph', lair: 'any', rarity: 0.05 }
];

export const CONTRACT_TYPES = {
  combat: ['Field Battle Support', 'Siege Relief', 'Raid Counter-Raid', 'Patrol Route Clearance', 'Assassination Capture', 'Monster Hunt', 'Defensive Hold'],
  crisis: ['Famine Relief', 'Plague Containment', 'Refugee Escort', 'Rebuild Infrastructure'],
  opportunity: ['Ruin Expedition', 'Battlefield Salvage', 'Prospecting Claim Defense'],
  ambition: ['Found Settlement', 'Take Keep', 'Necromancer Chain', 'Demon Pact', 'Political Coup']
};

export const RUMOR_SOURCES = ['Tavern', 'Travelers', 'Scouts', 'Militia', 'Merchants', 'Pilgrims'];

export const EVENT_TYPES = [
  'Dragon of Cinderpeak', 'Necromancer of Rotmarsh', 'Betrayal of House Varnoth', 'The Crimson Plague',
  'Siege of Blackgate', 'Miracle at Stonewatch', 'Ash March Uprising', 'Leviathan Wake',
  'Salt Steppe Succession', 'Blackwood Totem War', 'Crown Tax Revolt', 'Harpy Court Raids',
  'River Prince Compact', 'Arcane Schism', 'Inquisition March', 'Undead Blight Advance',
  'Harvest Blessing', 'Stormbound Fleet', 'Plague Cartel', 'Relic Discovery'
];

export const EVENT_TEMPLATES = {
  chronicle: [
    'Word spreads that {actor} moved against {target} in {province}.',
    'The roads to {province} carry grim news of {event}.',
    'Pilgrims whisper that {deity} has turned a wary eye toward {province}.',
    'In the halls of {faction}, banners were lowered after the loss at {province}.',
    'A caravan from {province} brings testimony of {event}.',
    'At dusk, bells in {province} rang for those taken by {event}.',
    'Riders reached the Chronicle Hall: {event} now grips {province}.',
    'The magistrates of {province} proclaimed a harsh answer to {event}.',
    'Across market squares, criers repeat that {actor} seeks vengeance in {province}.',
    'The old stones of {province} are said to hum with the echo of {event}.',
    'Messengers from {faction} report that {event} has changed the frontier.',
    'A weathered veteran swore that {actor} was seen near {province} before dawn.',
    'Fear and prayer mingle in {province} as {event} deepens.',
    'Coin and blood both flow toward {province}; {event} shows no mercy.',
    'The lords debate in candlelight while {event} spreads through {province}.',
    'Refugees from {province} describe smoke on the horizon and the sign of {event}.',
    'Courtiers claim {deity} has marked {province}, though none agree why.',
    'Market ledgers in {province} show the hidden cost of {event}.',
    'The frontier songs now name {actor} beside {event}.',
    'The ink is still wet: {faction} has answered {event} with steel.'
  ],
  rumors: [
    '{province}: a pack of riders vanishes at dusk; some say {event}.',
    '{province}: merchants swear the roads are clear, but scouts tell another tale.',
    '{province}: an old shrine burns with strange light each midnight.',
    '{province}: militia captains seek sellswords before winter closes the pass.',
    '{province}: smugglers offer maps to forgotten vaults under the marsh.',
    '{province}: sermons now end with warnings about {actor}.',
    '{province}: the tavern keeper says tax wagons went missing near the ford.',
    '{province}: strange tracks found where no beast should walk.',
    '{province}: caravans arrive with half their guards and twice their fear.',
    '{province}: a captain offers silver for proof of {event}.',
    '{province}: lights were seen in the ruins; priests call it an omen.',
    '{province}: rumor says a relic was unearthed and hidden by {faction}.',
    '{province}: fields stand unharvested after raiders crossed the ridge.',
    '{province}: a mercenary band returned rich and silent from the old keep.',
    '{province}: ferrymen refuse night crossings after hearing screams downstream.',
    '{province}: the magistrate denies unrest, yet extra guards patrol the gate.',
    '{province}: pilgrims claim {deity} performed a sign at dawn.',
    '{province}: a scholar seeks escorts into cursed catacombs.',
    '{province}: black banners were spotted near the boundary stones.',
    '{province}: bounty boards fill faster than they can be cleared.'
  ],
  proclamations: [
    '{faction} decrees emergency levies in {province} until order is restored.',
    '{faction} proclaims amnesty for deserters who return to defend {province}.',
    '{faction} announces holy procession and curfew within {province}.',
    '{faction} sets new tolls on roads through {province}.',
    '{faction} commands all guilds in {province} to supply the war effort.',
    '{faction} declares monster bounties doubled across {province}.',
    '{faction} issues harbor restrictions affecting trade from {province}.',
    '{faction} proclaims tax relief to recover farms in {province}.',
    '{faction} outlaws unsanctioned arcane rites in {province}.',
    '{faction} authorizes the raising of local militias in {province}.',
    '{faction} opens granaries in {province} under armed watch.',
    '{faction} orders bridge repairs and fortified checkpoints in {province}.',
    '{faction} announces trials for corruption tied to losses in {province}.',
    '{faction} grants mercenary charters for frontier patrols in {province}.',
    '{faction} commands all watchtowers in {province} to signal nightly.',
    '{faction} declares a day of mourning and resolve in {province}.',
    '{faction} bars cult gatherings and inquisitors advance into {province}.',
    '{faction} rewards informants exposing traitors in {province}.',
    '{faction} allocates steel and timber to rebuild {province}.',
    '{faction} names a temporary governor over {province} until peace returns.'
  ]
};

export const BIOMES = ['ocean', 'coast', 'lowland', 'hills', 'mountains', 'peaks', 'forest', 'swamp', 'desert', 'steppe'];

export const EXTENDED_TEMPLATES = {
  chronicle: [...EVENT_TEMPLATES.chronicle, ...NARRATIVE_INDEX.chronicle],
  rumors: [...EVENT_TEMPLATES.rumors, ...NARRATIVE_INDEX.rumor],
  proclamations: [...EVENT_TEMPLATES.proclamations, ...NARRATIVE_INDEX.proclamation]
};

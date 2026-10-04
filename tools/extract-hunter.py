#!/usr/bin/env python3
"""Extract Hunter mechanics from Forever's generated game data; no media assets."""
import argparse,gzip,json,re
from pathlib import Path
game=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,required=True,help='Directory containing the simulator data')
root=parser.parse_args().source.expanduser().resolve()
source=(root/'sim/hunter/spell_data_auto_gen.go').read_text()
generated=(root/'sim/core/spelldata/spells_auto_gen.go').read_text()
store=json.load(gzip.open(root/'assets/db_inputs/spell_store_inputs.json','rt'))
trees=json.loads((root/'ui/sim/talents/trees/hunter.json').read_text())
curves={int(k):json.loads(v.replace('{','[').replace('}',']')) for k,v in re.findall(r'^\s*(\d+):\s+(\{\{[^\n]+?\}\}),$',generated,re.M)}
def row(spell_id):
 k=str(spell_id);m=store['Misc'].get(k,{});c=store['Cooldowns'].get(k,{});p=store['Powers'].get(k,[{}])[0]
 return dict(id=spell_id,name=store['Names'].get(k,''),description=store['Descriptions'].get(k,''),minRange=m.get('MinRange',0),maxRange=m.get('MaxRange',0),castMs=max(0,m.get('CastTimeMs',0)),durationMs=m.get('DurationMs',0),speed=m.get('Speed',0),school=m.get('School',1),cooldownMs=max(c.get('CooldownMs',0),c.get('CategoryCooldownMs',0)),gcdMs=c.get('GCDMs',0),mana=p.get('Cost',0),manaPct=p.get('CostPct',0),powerType=p.get('PowerType',0),aura=store['AuraOptions'].get(k,{}),effects=[dict(value=e.get('BasePoints',0),periodMs=e.get('PeriodMs',0),targets=e.get('ChainTargets',0),type=e.get('Type',0),aura=e.get('Aura',0),misc=e.get('Misc',0),trigger=e.get('TriggerID',0),ap=e.get('APCoef',0),variance=e.get('Variance',0),ppl=e.get('PPL',0),radius=e.get('RadiusMax',0),flags=e.get('ClassFlags',{}).get('Mask',[])) for e in store['Effects'].get(k,[])])
records={}
for name,ids in re.findall(r'^\s*(\w+):\s+spelldata\.Ranked\(([^)]+)\)',source,re.M):
 records[name]=row(int(ids.split(',')[-1].strip()))
active="""AutoShot ArcaneShot AimedShot MultiShot SerpentSting ScorpidSting HuntersMark RaptorStrike MongooseBite RapidFire SniperShot AspectOfTheHawk AspectOfTheBeast SummonHawk StriderKick BestialWrath ConcussiveShot ScatterShot WingClip Counterattack Deterrence Disengage DistractingShot TranquilizingShot ViperSting BlackArrow Lacerate Volley ImmolationTrap ExplosiveTrap FreezingTrap FrostTrap FeignDeath Intimidation TrueshotAura HeartOfTheLion AspectOfTheMonkey AspectOfTheCheetah AspectOfThePack AspectOfTheWild AspectOfTheViper AspectOfTheFalcon CallPet DismissPet RevivePet MendPet FeedPet TameBeast BeastLore BeastTraining EyesOfTheBeast EagleEye Flare EnchantedFlare ScareBeast TrackBeasts TrackDemons TrackDragonkin TrackElementals TrackGiants TrackHidden TrackHumanoids TrackUndead""".split()
talents=[]
for tree in trees:
 ts=[]
 for t in tree['talents']:
  d=dict(field=t['fieldName'],name=t['fancyName'],row=t['location']['rowIdx'],col=t['location']['colIdx'],max=t['maxPoints'],spellId=t['spellId'],data=row(t['spellId']),curves=curves.get(t['spellId'],[]))
  if 'prereqLocation' in t:d['requires']=t['prereqLocation']
  ts.append(d)
 talents.append(dict(name=tree['name'],talents=ts))
families={}
pet_source=(root/'sim/hunter/pet_families_auto_gen.go').read_text()
for key,name,passive,abilities in re.findall(r'"(\w+)":\s+\{Name: "([^"]+)", Passive: spelldata.Ranked\((\d+)\), Abilities: \[\]spelldata.Ladder\{([^}]+)\}',pet_source):
 families[key]=dict(name=name,passive=row(int(passive)),abilities=re.findall(r'spellData\.(\w+)',abilities))
out=dict(spells={n:records[n] for n in active},records=records,talents=talents,petFamilies=families)
dest=game/'src/hunter-data.json';tmp=dest.with_suffix('.tmp');tmp.write_text(json.dumps(out,separators=(',',':'))+'\n');tmp.replace(dest)
print(f'Extracted {len(active)} abilities, {sum(len(t["talents"]) for t in talents)} talents, {len(families)} pet families')

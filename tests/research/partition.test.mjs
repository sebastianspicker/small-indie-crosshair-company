import test from 'node:test';import assert from 'node:assert/strict';
import{MODELS}from'../../lib/solver/renderer.js';
import{equivalenceGroups,areEquivalent,differenceWitness,geometrySignature,vectorSignature,defaultDomain}from'../../research/lib/partition.js';
// Reduced but non-trivial sample keeps the exhaustive pair check fast.
const domain={natives:[],heights:[720,1080,1440],description:'reduced unit-test sample'};
for(const length of[0,1,2,3,4,5,7,10,16,255])
  for(const thickness of[0,1,2,3])
    for(const gap of[0,1,2,3,4,7,16,64,128])
      for(const authoredHeight of[720,1080])
        domain.natives.push({length,thickness,gap,authoredHeight});
const modelIndex=id=>MODELS.findIndex(m=>m.id===id);
function nearestOutside(members){
  const anchor=modelIndex(members[0]);
  return MODELS.filter(m=>!members.includes(m.id))
    .reduce((best,m)=>Math.abs(modelIndex(m.id)-anchor)<Math.abs(modelIndex(best.id)-anchor)?m:best);
}

test('partition covers the 27 models exactly once within the distinct bound',()=>{
  const{groups,distinct,total,domain:reported}=equivalenceGroups(domain);
  assert.equal(total,MODELS.length);
  assert.equal(distinct,groups.length);
  assert.ok(distinct<=MODELS.length);
  const seen=groups.flatMap(g=>g.members);
  assert.equal(seen.length,MODELS.length);
  assert.equal(new Set(seen).size,MODELS.length);
  assert.deepEqual([...seen].sort(),MODELS.map(m=>m.id).sort());
  assert.equal(reported.natives,domain.natives.length);
  assert.deepEqual(reported.heights,domain.heights);
});

test('groups agree with exhaustive pairwise equivalence over the sample',()=>{
  const{groups}=equivalenceGroups(domain);
  const byId=new Map();
  for(const group of groups)for(const id of group.members)byId.set(id,group.id);
  for(let i=0;i<MODELS.length;i++)for(let j=i+1;j<MODELS.length;j++){
    const a=MODELS[i],b=MODELS[j],same=byId.get(a.id)===byId.get(b.id);
    assert.equal(areEquivalent(a,b,domain),same,`${a.id} vs ${b.id}`);
    const witness=differenceWitness(a,b,domain);
    if(same)assert.equal(witness,null,`${a.id} vs ${b.id} should not differ`);
    else{
      assert.ok(witness,`${a.id} vs ${b.id} needs a witness`);
      assert.notEqual(geometrySignature(a,witness.native,witness.height),geometrySignature(b,witness.native,witness.height));
    }
  }
});

test('same-group members render identically on every sampled cell',()=>{
  const{groups}=equivalenceGroups(domain);
  for(const group of groups)for(let k=1;k<group.members.length;k++)
    for(const native of domain.natives)for(const height of domain.heights)
      assert.equal(geometrySignature(group.members[0],native,height),geometrySignature(group.members[k],native,height));
});

test('literal-zero thickness exposes real redundancy with informative witnesses',()=>{
  // With rendered width pinned to one pixel, floor(width/2)=0, so the
  // thickness-relative baseline equals the center-relative one. This is a true
  // redundancy on a restricted domain and exercises multi-member witnesses.
  const dot={natives:domain.natives.filter(n=>n.thickness===0),heights:[720,1080],description:'dot-only sample'};
  const{groups}=equivalenceGroups(dot);
  const merged=groups.filter(group=>group.members.length>1);
  assert.ok(merged.length>0);
  // The thickness-relative/center-relative pair is the redundancy this branch guarantees.
  assert.ok(merged.some(group=>group.members.some(id=>id.endsWith(':thickness'))&&group.members.some(id=>id.endsWith(':center'))));
  for(const group of merged){
    const witness=group.witness;
    assert.ok(witness);
    for(const id of group.members)
      assert.equal(geometrySignature(group.members[0],witness.native,witness.height),geometrySignature(id,witness.native,witness.height));
    // A multi-member witness should also separate the class from its closest model.
    assert.notEqual(geometrySignature(group.members[0],witness.native,witness.height),geometrySignature(nearestOutside(group.members),witness.native,witness.height));
  }
});

test('vectorSignature is index-aligned with the model list',()=>{
  const native=domain.natives[0],height=domain.heights[0];
  assert.deepEqual(vectorSignature(MODELS,native,height),MODELS.map(m=>geometrySignature(m,native,height)));
});

test('default domain is deterministic and its description names the sample',()=>{
  const a=defaultDomain(),b=defaultDomain();
  assert.deepEqual(a.natives,b.natives);
  assert.deepEqual(a.heights,b.heights);
  assert.equal(a.natives[0].authoredHeight,720);
  assert.match(a.description,/SAMPLED domain/);
  assert.equal(a.natives.length,256*5*9*3);
});

test('partition is deterministic across runs',()=>{
  assert.deepEqual(equivalenceGroups(domain),equivalenceGroups(domain));
});

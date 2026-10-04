export class WeavingStats {
  constructor() {
    Object.assign(this,{shots:0,intervals:0,totalDelay:0,worstDelay:0,lastDelay:null,lastInterval:null,
      windupClips:0,weaves:0,totalAway:0,totalSwings:0,lastWeave:null,active:null,wasInside:null});
  }
  position(now,range,min,max,enabled) {
    if(!enabled){this.active=null;this.wasInside=null;return;}
    const inside=range<min;
    if(inside&&this.wasInside===false&&this.shots>0){
      this.active??={away:0,entered:null,returned:null,swings:0};
      this.active.entered=now;this.active.returned=null;
    }
    if(!inside&&range<=max&&this.active?.entered!=null){
      this.active.away+=now-this.active.entered;
      this.active.entered=null;this.active.returned=now;
    }
    this.wasInside=inside;
  }
  melee(){if(this.active)this.active.swings++;}
  shot(now,expected,previous) {
    this.shots++;
    const delay=expected===null?null:Math.max(0,now-expected);
    if(delay!==null){
      this.intervals++;this.totalDelay+=delay;this.worstDelay=Math.max(this.worstDelay,delay);
      this.lastDelay=delay;this.lastInterval=now-previous;
    }
    if(this.active?.returned!=null){
      if(this.active.swings>0){
        this.weaves++;this.totalAway+=this.active.away;this.totalSwings+=this.active.swings;
        this.lastWeave={away:this.active.away,swings:this.active.swings,returnToShot:now-this.active.returned,delay};
      }
      this.active=null;
    }
  }
  snapshot(now,expected) {
    return {shots:this.shots,intervals:this.intervals,lastDelay:this.lastDelay,lastInterval:this.lastInterval,
      liveDelay:expected===null?0:Math.max(0,now-expected),totalDelay:this.totalDelay,worstDelay:this.worstDelay,
      averageDelay:this.intervals?this.totalDelay/this.intervals:null,windupClips:this.windupClips,
      weaves:this.weaves,averageAway:this.weaves?this.totalAway/this.weaves:null,
      averageSwings:this.weaves?this.totalSwings/this.weaves:null,lastWeave:this.lastWeave?{...this.lastWeave}:null,
      active:this.active?{away:this.active.away+(this.active.entered===null?0:now-this.active.entered),swings:this.active.swings,returned:this.active.returned}:null};
  }
}
(function(){
'use strict';
// `claude-haiku-4-5` is a current Anthropic API alias. Keep the legacy scheduler's
// configured model unchanged; this patch only hardens how screenshot busy slots
// are fed into the scheduling engine.
if(typeof runAIForCache==='function'){
  const originalRunAIForCache=runAIForCache;
  runAIForCache=async function(){
    const result=await originalRunAIForCache.apply(this,arguments);
    Object.keys(icsCache).forEach(id=>{
      const c=icsCache[id];
      if(!c||!Array.isArray(c.slots))return;
      c.slots.forEach(s=>{
        // If the screenshot did not expose a concrete date, treat the detected busy
        // weekday/time conservatively as recurring for recommendation purposes.
        if(s.dateStr==='ai')s.recurring=true;
        if(!Number.isFinite(s.startMin)&&Number.isFinite(s.hour)){
          s.startMin=s.hour*60+(s.minute||0);
          s.endMin=s.startMin+60;
        }
      });
    });
    return result;
  };
}
})();
(function(){
'use strict';
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  try{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(url.includes('api.anthropic.com/v1/messages')&&init&&typeof init.body==='string'){
      const body=JSON.parse(init.body);
      if(body.model==='claude-haiku-4-5'){
        body.model='claude-sonnet-4-20250514';
        init={...init,body:JSON.stringify(body)};
      }
    }
  }catch(_){}
  return nativeFetch(input,init);
};

if(typeof runAIForCache==='function'){
  const originalRunAIForCache=runAIForCache;
  runAIForCache=async function(){
    const result=await originalRunAIForCache.apply(this,arguments);
    Object.keys(icsCache).forEach(id=>{
      const c=icsCache[id];
      if(!c||!Array.isArray(c.slots))return;
      c.slots.forEach(s=>{
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
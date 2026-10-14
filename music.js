/* Soundtrack: put menu.mp3 and fight.mp3 next to index.html. Missing files are skipped. */
(function(){
 const T={menu:new Audio('menu.mp3'),fight:new Audio('fight.mp3')};
 let cur=null,go=false;
 for(const k in T){T[k].loop=true;T[k].volume=.4;T[k].onerror=()=>{T[k].bad=true}}
 addEventListener('pointerdown',()=>{go=true},{once:true});
 setInterval(()=>{
  const want=typeof muted!=='undefined'&&muted||!go||document.hidden?null:(mode==='menu'?'menu':'fight');
  for(const k in T)T[k].volume=typeof cfg!=='undefined'?cfg.vol:.4;
  if(want===cur)return;
  if(cur&&T[cur])T[cur].pause();
  cur=want;
  if(cur&&!T[cur].bad)T[cur].play().catch(()=>{cur=null});
 },400);
})();

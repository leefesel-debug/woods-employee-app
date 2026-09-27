// COGS menu-item deletion fix v1
// Deletes only the menu item (and its recipe rows) from shared Supabase data.
// The master ingredient list is deliberately untouched.
(function(){
  const originalDeleteMenuItem=window.deleteMenuItem;
  if(typeof originalDeleteMenuItem!=='function') return;

  window.deleteMenuItem=async function(id){
    const p=data.products.find(x=>x.id===id);
    if(!p)return;
    if(!confirm(`Permanently delete ${p.name} from the menu? This will not delete any ingredients from the Master Cost List.`))return;

    try{
      if(typeof cogsDb!=='undefined' && cogsDb && typeof cogsUser!=='undefined' && cogsUser && typeof cogsRemoteReady!=='undefined' && cogsRemoteReady){
        let q=await cogsDb.from('cogs_recipes').delete().eq('menu_item_id',id);
        if(q.error)throw q.error;
        q=await cogsDb.from('cogs_menu_items').delete().eq('id',id);
        if(q.error)throw q.error;
      }

      data.products=data.products.filter(x=>x.id!==id);
      persist();
      render();
      if(typeof cogsBanner==='function')cogsBanner(`${p.name} deleted from menu · Master Cost List unchanged`,'ok');
    }catch(e){
      console.error(e);
      if(typeof cogsBanner==='function')cogsBanner('Menu item delete failed: '+(e.message||e),'error');
      else alert('Menu item delete failed: '+(e.message||e));
    }
  };
})();

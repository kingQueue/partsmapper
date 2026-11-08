const libraryCardBeforeResearch=libraryCardHTML;
libraryCardHTML=function(n,source='library'){
  const html=libraryCardBeforeResearch(n,source);if(!n.research)return html.replace('</small>',' · unverified template</small>');
  return html.replace('</small>',` · ${esc(n.variant||'')} · ${n.research.status==='documented'?'source-linked':'draft · review needed'} · electrically unverified</small>`);
};
const inspectorBeforeResearch=renderInspector;
renderInspector=function(){
  inspectorBeforeResearch();const n=node(selected);if(!n?.research)return;
  const section=document.createElement('section');section.className='pin-editor';
  const sources=(Array.isArray(n.research.sources)?n.research.sources:[]).filter(s=>s&&typeof s.url==='string'&&s.url.startsWith('https://'));
  section.innerHTML=`<div class="section-label">RESEARCH &amp; DOCUMENTATION</div><p>${esc(n.manufacturer||'')} · ${esc(n.variant||'')} · ${esc(n.research.status)} · Electrical verification: ${esc(n.research.verification?.electrical||'unverified')}</p>${typeof n.productUrl==='string'&&n.productUrl.startsWith('https://')?`<p><a class="component-product-link" href="${esc(n.productUrl)}" target="_blank" rel="noopener noreferrer">Product page ↗</a></p>`:''}<p class="muted">Source-linked data; physical wiring and footprints are not validated.</p>${sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a></p>`).join('')}<p>${esc((Array.isArray(n.research.unresolved)?n.research.unresolved:[]).filter(u=>u&&typeof u.field==='string'&&typeof u.needed==='string').map(u=>u.field+': '+u.needed).join(' · ')||'No unresolved fields recorded.')}</p>`;
  section.innerHTML+=`<details><summary>Specifications and dimensions</summary><pre>${esc(JSON.stringify({dimensions:n.dimensions,specifications:n.specifications},null,2))}</pre></details><details><summary>Recorded physical pinout (${n.pins.length})</summary><div style="overflow:auto"><table><thead><tr><th>Pin</th><th>Header / label</th><th>Functions</th></tr></thead><tbody>${n.pins.map(p=>`<tr><td>${esc(p.number||'')}</td><td>${esc(pinLabel(n,p))}</td><td>${esc((Array.isArray(p.functions)?p.functions:[]).join(', '))}</td></tr>`).join('')}</tbody></table></div></details>`;
  document.querySelector('#inspector .inspector-bottom')?.before(section);
};

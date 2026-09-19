// ==UserScript==
// @name         HOJ 一键添加题目 - Markdown粘贴即创建 v2.1
// @namespace    https://github.com/<你的GitHub用户名>/hoj-quick-add
// @version      2.1
// @description  v2.1：新增标签模糊搜索下拉多选；展示ID留空自动递增分配并判重重试；面板固定居中尺寸；沿用提示栏合并、曜石黑按钮、examples原生格式、难度0-8、默认公开、完整预览、样例双写
// @author       Assistant
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/OnceValleyAmple/hoj-quick-add/main/hoj-quick-add.user.js
// @downloadURL  https://raw.githubusercontent.com/OnceValleyAmple/hoj-quick-add/main/hoj-quick-add.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (!location.pathname.includes('/admin')) return;
  if (document.getElementById('hoj-quick-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'hoj-quick-btn';
  btn.innerHTML = '⚡';
  btn.title = 'Quick Add';
  btn.style.cssText = 'position:fixed;top:70px;right:20px;z-index:999999;background:#18181b;color:#fff;width:46px;height:46px;border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,.35);cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;user-select:none';
  document.body.appendChild(btn);
  let panel=null;

  // 难度映射（与你截图的难度管理一一对应 0-8）
  const DIFFICULTY = [
    {value:0, label:'暂无评定', color:'#bfbfbf'},
    {value:1, label:'入门', color:'#ff4d4f'},
    {value:2, label:'普及-', color:'#ff7a45'},
    {value:3, label:'普及', color:'#faad14'},
    {value:4, label:'普及+/提高-', color:'#52c41a'},
    {value:5, label:'提高', color:'#13c2c2'},
    {value:6, label:'提高+/省选-', color:'#1890ff'},
    {value:7, label:'省选/NOI-', color:'#722ed1'},
    {value:8, label:'NOI/NOI+/CTS', color:'#2f54eb'},
  ];

  function parseMarkdown(md){
    let title=(md.match(/^#\s+(.+)$/m)||[])[1]?.trim()||"";
    let sections={}, cur=null, buf=[];
    for(let l of md.split('\n')){
      let m=l.match(/^##\s+(.+?)\s*$/);
      if(m){ if(cur) sections[cur]=buf.join('\n').trim(); cur=m[1].trim(); buf=[]; } else if(cur) buf.push(l);
    }
    if(cur) sections[cur]=buf.join('\n').trim();
    function find(kws, exclude){ for(let k in sections){ if(exclude && exclude.some(x=>k.includes(x))) continue; for(let kw of kws) if(k.includes(kw)) return sections[k]; } return ""; }
    let bg=find(["题目背景","背景"]), desc=find(["题目描述","问题描述","描述"]), inp=find(["输入格式","输入描述","输入"]), out=find(["输出格式","输出描述","输出"]), raw=find(["输入输出样例","输入输出示例"])||find(["样例","示例"],["解释","说明"])||md, hintRaw=find(["说明","提示","数据范围","限制"]), sampleExplain=find(["样例解释","样例说明"]);
    let fullDesc = bg? `${bg}\n\n${desc}`:desc;
    if(!fullDesc) fullDesc=sections[Object.keys(sections)[0]]||"";
    let ex=parseExamples(raw,md);
    // v2.0：提示栏按顺序合并 —— 先样例解释，再说明/提示（题目解析、参考代码不参与）
    let hint="";
    if(sampleExplain) hint+=`${sampleExplain}`;
    if(hintRaw) hint+=(hint?"\n\n":"")+hintRaw;
    return {title, description:fullDesc, input:inp, output:out, examples:ex, sampleExplain:sampleExplain||'', hint:hint||'', rawSections:sections};
  }
  function parseExamples(raw,fullMd){
    if(!raw) raw=fullMd;
    let s=[]; let parts=raw.split(/###\s*样例\s*\d+/);
    if(parts.length>1){
      for(let i=1;i<parts.length;i++){
        let b=[...parts[i].matchAll(/```(?:text|input|output)?\s*\n([\s\S]*?)```/g)].map(m=>m[1].trim());
        if(b.length>=2) s.push({input:b[0],output:b[1]});
        else if(b.length===1){
          // 尝试按 **输入** **输出** 文本分割
          let m = parts[i].match(/\*\*输入\*\*[\s\S]*?\n([\s\S]*?)\n[\s\S]*?\*\*输出\*\*[\s\S]*?\n([\s\S]*)/);
          if(m) s.push({input:m[1].trim(), output:m[2].trim()});
        }
      }
    }
    if(!s.length){
      let b=[...raw.matchAll(/```(?:text|input|output)?\s*\n([\s\S]*?)```/g)].map(m=>m[1].trim()).filter(x=>!x.includes("#include")&&x.length<2000);
      for(let i=0;i+1<b.length;i+=2) s.push({input:b[i],output:b[i+1]});
    }
    return s;
  }
  // v1.7 核心修复：与 HOJ 官方前端 utils.examplesToString 完全一致，
  // 使用原生格式 <input>...</input><output>...</output>，不要做任何 HTML 转义。
  // 官方编辑页用正则 /<input>([\s\S]*?)<\/input><output>([\s\S]*?)<\/output>/g 解析，
  // 若转义成 &lt;input&gt; 会匹配失败，导致题面样例显示为空。
  function examplesToString(list){
    if(!list.length) return "";
    let r=""; for(let e of list) r+= `<input>${e.input}</input><output>${e.output}</output>`;
    return r;
  }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function mdToHtml(md){
    // 极简 Markdown 转 HTML 用于预览（支持标题、粗体、代码块、行内代码、数学保留）
    let html = escapeHtml(md);
    html = html.replace(/^###\s+(.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:13px;border-left:3px solid #1890ff;padding-left:8px">$1</h4>');
    html = html.replace(/^##\s+(.+)$/gm, '<h3 style="margin:12px 0 6px;font-size:14px;color:#262626">$1</h3>');
    html = html.replace(/^#\s+(.+)$/gm, '<h2 style="margin:12px 0;font-size:16px;color:#1890ff">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:1px 4px;border-radius:4px;font-family:monospace">$1</code>');
    html = html.replace(/```text\s*\n([\s\S]*?)```/g, '<pre style="background:#fafafa;border:1px solid #f0f0f0;padding:8px;border-radius:6px;overflow:auto;font-family:monospace;white-space:pre-wrap">$1</pre>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#fafafa;border:1px solid #f0f0f0;padding:8px;border-radius:6px;overflow:auto;font-family:monospace;white-space:pre-wrap">$1</pre>');
    html = html.replace(/\n/g,'<br>');
    return html;
  }

  function createPanel(){
    if(panel){ panel.style.display = panel.style.display==='none'?'flex':'none'; return; }
    panel=document.createElement('div');
    panel.id='hoj-quick-panel';
    panel.style.cssText='position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
    // 难度下拉选项
    let diffOptions = DIFFICULTY.map(d=> `<option value="${d.value}" ${d.value===3?'selected':''} style="color:${d.color}">${d.label} (${d.value})</option>`).join('');
    panel.innerHTML=`
      <div style="background:#fff;width:1020px;max-width:96vw;height:min(760px,94vh);min-height:520px;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.2)">
        <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;background:#fafafa;align-items:center">
          <b>⚡ HOJ 一键添加题目 v2.1 <span style="color:#8c8c8c;font-weight:400;font-size:12px">难度0-8 · 默认公开 · 标签自选 · 完整预览</span></b><span id="hoj-close" style="cursor:pointer;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:50%">✕</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1.15fr;gap:0;flex:1;overflow:hidden;min-height:0">
          <div style="border-right:1px solid #f0f0f0;display:flex;flex-direction:column;overflow:hidden;min-height:0">
            <div style="padding:10px 12px;background:#fafafa;border-bottom:1px solid #f0f0f0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input id="hoj-pid" placeholder="展示ID 留空自动递增" style="flex:1;min-width:110px;padding:6px 8px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px">
              <select id="hoj-auth" style="padding:6px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px"><option value="1" selected>公开题目</option><option value="2">私有题目</option><option value="3">比赛题目</option></select>
              <select id="hoj-difficulty" style="padding:6px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px;min-width:130px">${diffOptions}</select>
              <span id="hoj-diff-color" style="width:16px;height:16px;border-radius:4px;background:#faad14;display:inline-block;border:1px solid #eee" title="难度颜色示例"></span>
            </div>
            <div style="padding:8px 12px;background:#fff;border-bottom:1px solid #f0f0f0;position:relative">
              <div style="display:flex;gap:6px;align-items:center">
                <input id="hoj-tag-search" placeholder="🏷 搜索标签…" autocomplete="off" style="flex:1;min-width:0;padding:6px 8px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px;outline:none">
                <span id="hoj-tag-count" style="font-size:11px;color:#8c8c8c;white-space:nowrap">已选 0</span>
                <span id="hoj-tag-clear" style="font-size:11px;color:#1890ff;cursor:pointer;white-space:nowrap">清空</span>
              </div>
              <div id="hoj-tag-chips" style="display:none;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:52px;overflow:auto"></div>
              <div id="hoj-tag-dropdown" style="display:none;position:absolute;left:12px;right:12px;top:100%;margin-top:2px;background:#fff;border:1px solid #e8e8e8;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:230px;overflow:auto;z-index:10"></div>
            </div>
            <textarea id="hoj-md" placeholder="在此粘贴 Markdown&#10;# 标题&#10;## 题目描述&#10;## 输入格式&#10;## 输出格式&#10;## 输入输出样例&#10;### 样例 1&#10;**输入**&#10;\`\`\`text&#10;4 6&#10;\`\`\`" style="flex:1;border:none;padding:12px;font-family:monospace;font-size:12px;resize:none;outline:none;min-height:0"></textarea>
            <div style="padding:8px 10px;border-top:1px solid #f0f0f0;display:flex;gap:8px">
              <button id="hoj-parse" style="flex:1;padding:8px;background:#1890ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">🔍 解析预览</button>
              <button id="hoj-clear" style="padding:8px 12px;background:#fff;border:1px solid #d9d9d9;border-radius:6px;cursor:pointer">清空</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;overflow:hidden;min-height:0">
            <div style="display:flex;gap:6px;padding:8px 10px;background:#fafafa;border-bottom:1px solid #f0f0f0">
              <button class="hoj-tab active" data-tab="preview" style="padding:5px 10px;border-radius:20px;border:1px solid #1890ff;background:#1890ff;color:#fff;font-size:12px;cursor:pointer">题目预览</button>
              <button class="hoj-tab" data-tab="samples" style="padding:5px 10px;border-radius:20px;border:1px solid #d9d9d9;background:#fff;font-size:12px;cursor:pointer">样例</button>
              <button class="hoj-tab" data-tab="raw" style="padding:5px 10px;border-radius:20px;border:1px solid #d9d9d9;background:#fff;font-size:12px;cursor:pointer">原始</button>
            </div>
            <div id="hoj-preview" style="flex:1;overflow:auto;padding:12px;font-size:12px;background:#fff;min-height:0">粘贴后点“解析预览”，此处将完整渲染题面</div>
            <div id="hoj-log" style="height:150px;overflow:auto;background:#0f1419;color:#0f0;padding:8px;font-family:monospace;font-size:11px;white-space:pre-wrap;border-top:1px solid #1e293b">> 等待操作...</div>
            <div style="padding:10px;border-top:1px solid #f0f0f0;display:flex;gap:8px">
              <button id="hoj-create" style="flex:1;padding:9px;background:#52c41a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700">🚀 一键创建题目</button>
              <button id="hoj-close2" style="padding:9px 14px;background:#fff;border:1px solid #d9d9d9;border-radius:6px;cursor:pointer">关闭</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#hoj-close').onclick=()=>panel.style.display='none';
    panel.querySelector('#hoj-close2').onclick=()=>panel.style.display='none';
    panel.onclick=e=>{if(e.target===panel)panel.style.display='none'};
    panel.querySelector('#hoj-parse').onclick=doParse;
    panel.querySelector('#hoj-create').onclick=doCreate;
    panel.querySelector('#hoj-clear').onclick=()=>{ panel.querySelector('#hoj-md').value=''; };
    // 难度颜色联动
    const diffSel = panel.querySelector('#hoj-difficulty');
    const colorBox = panel.querySelector('#hoj-diff-color');
    function updateColor(){ const v=parseInt(diffSel.value); const d=DIFFICULTY.find(x=>x.value===v); colorBox.style.background=d?d.color:'#fff'; colorBox.title=d?`${d.label} ${d.color}`:''; }
    diffSel.onchange=updateColor; updateColor();
    // 🏷 标签搜索下拉接线
    const _tok0=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
    loadTags(_tok0);
    const tagSearch=panel.querySelector('#hoj-tag-search');
    tagSearch.addEventListener('input', renderTagDropdown);
    tagSearch.addEventListener('focus', ()=>{ if(!allTagsFlat.length) loadTags(_tok0); renderTagDropdown(); });
    tagSearch.addEventListener('keydown', e=>{
      const dd=document.getElementById('hoj-tag-dropdown');
      if(e.key==='Escape'){ hideTagDropdown(); return; }
      if(!dd||dd.style.display==='none') return;
      if(e.key==='ArrowDown'){ e.preventDefault(); tagActiveIndex=Math.min(tagActiveIndex+1,tagCurrentList.length-1); paintTagDropdown(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); tagActiveIndex=Math.max(tagActiveIndex-1,0); paintTagDropdown(); }
      else if(e.key==='Enter'){ e.preventDefault(); if(tagActiveIndex>=0) addTag(tagCurrentList[tagActiveIndex]); }
    });
    panel.querySelector('#hoj-tag-clear').onclick=()=>{ selectedTags=[]; renderTagChips(); paintTagDropdown(); };
    document.addEventListener('click', e=>{ if(panel&&panel.style.display!=='none'&&!e.target.closest('#hoj-tag-search')&&!e.target.closest('#hoj-tag-dropdown')) hideTagDropdown(); });
    // tab 切换
    panel.querySelectorAll('.hoj-tab').forEach(b=>{
      b.onclick=()=>{
        panel.querySelectorAll('.hoj-tab').forEach(x=>{ x.style.background='#fff'; x.style.color='#595959'; x.style.borderColor='#d9d9d9'; });
        b.style.background='#1890ff'; b.style.color='#fff'; b.style.borderColor='#1890ff';
        const tab=b.dataset.tab;
        if(tab==='preview') renderPreview('preview');
        else if(tab==='samples') renderPreview('samples');
        else renderPreview('raw');
      };
    });
  }

  function log(m,c){
    const el=document.getElementById('hoj-log');
    if(!el) return;
    const t=new Date().toLocaleTimeString();
    const col=c==='err'?'#ff4d4f':c==='ok'?'#52c41a':c==='warn'?'#faad14':'#0f0';
    el.innerHTML+=`<div style="color:${col}">[${t}] ${m}</div>`;
    el.scrollTop=el.scrollHeight; console.log(m);
  }
  let lastParsed=null;
  let allTagsFlat=[], selectedTags=[], tagLoaded=false, tagLoading=null, tagActiveIndex=-1, tagCurrentList=[];
  let activeTab='preview';
  function renderPreview(mode){
    activeTab=mode;
    if(!lastParsed) return;
    const p=lastParsed;
    const preview = document.getElementById('hoj-preview');
    if(mode==='preview'){
      // 完整题面渲染
      let html = `
        <div style="border:1px solid #f0f0f0;border-radius:8px;overflow:hidden">
          <div style="background:#fafafa;padding:8px 10px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
            <b style="font-size:14px;color:#262626">${p.title || '无标题'}</b>
            <span style="padding:2px 8px;border-radius:10px;color:#fff;font-size:11px;background:${(DIFFICULTY.find(d=>d.value===parseInt(document.getElementById('hoj-difficulty').value))||{}).color||'#bfbfbf'}">${(DIFFICULTY.find(d=>d.value===parseInt(document.getElementById('hoj-difficulty').value))||{}).label||''}</span>
          </div>
          ${selectedTags.length?`<div style="padding:6px 10px;border-bottom:1px solid #f0f0f0;display:flex;flex-wrap:wrap;gap:4px;align-items:center"><span style="font-size:11px;color:#8c8c8c">🏷 标签：</span>${selectedTags.map(t=>`<span style="font-size:11px;padding:1px 8px;border-radius:10px;background:#f5f5f5;border:1px solid #e8e8e8">${escapeHtml(t.tag.name)}</span>`).join('')}</div>`:''}
          <div style="padding:10px">
            <h4 style="margin:8px 0 4px;color:#1890ff;border-left:3px solid #1890ff;padding-left:8px;font-size:13px">题目描述</h4>
            <div style="background:#fafafa;border:1px solid #f0f0f0;padding:8px;border-radius:6px;white-space:pre-wrap">${mdToHtml(p.description||'暂无')}</div>
            <h4 style="margin:10px 0 4px;color:#1890ff;border-left:3px solid #1890ff;padding-left:8px;font-size:13px">输入格式</h4>
            <div style="background:#fafafa;border:1px solid #f0f0f0;padding:8px;border-radius:6px;white-space:pre-wrap">${mdToHtml(p.input||'暂无')}</div>
            <h4 style="margin:10px 0 4px;color:#1890ff;border-left:3px solid #1890ff;padding-left:8px;font-size:13px">输出格式</h4>
            <div style="background:#fafafa;border:1px solid #f0f0f0;padding:8px;border-radius:6px;white-space:pre-wrap">${mdToHtml(p.output||'暂无')}</div>
            <h4 style="margin:10px 0 4px;color:#1890ff;border-left:3px solid #1890ff;padding-left:8px;font-size:13px">样例 (${p.examples.length}组)</h4>
            ${p.examples.length? `<table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#fafafa"><th style="border:1px solid #f0f0f0;padding:6px">#</th><th style="border:1px solid #f0f0f0;padding:6px">输入</th><th style="border:1px solid #f0f0f0;padding:6px">输出</th></tr>${p.examples.map((e,i)=>`<tr><td style="border:1px solid #f0f0f0;padding:6px">${i+1}</td><td style="border:1px solid #f0f0f0;padding:6px;white-space:pre-wrap;background:#fff">${escapeHtml(e.input)}</td><td style="border:1px solid #f0f0f0;padding:6px;white-space:pre-wrap;background:#fff">${escapeHtml(e.output)}</td></tr>`).join('')}</table>` : '<div style="color:#8c8c8c">无样例</div>'}
            <h4 style="margin:10px 0 4px;color:#1890ff;border-left:3px solid #1890ff;padding-left:8px;font-size:13px">提示</h4>
            <div style="background:#fafafa;border:1px solid #f0f0f0;padding:8px;border-radius:6px;white-space:pre-wrap">${mdToHtml(p.hint||'无')}</div>
          </div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#8c8c8c">提示：样例将同时写入“题面样例”与“评测数据”；“提示”栏 = 样例解释 + 说明/提示；后续可在题目编辑页上传 zip 覆盖评测数据</div>
      `;
      preview.innerHTML = html;
    } else if(mode==='samples'){
      preview.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#fafafa"><th style="border:1px solid #f0f0f0;padding:6px">#</th><th style="border:1px solid #f0f0f0;padding:6px">输入</th><th style="border:1px solid #f0f0f0;padding:6px">输出</th></tr>${lastParsed.examples.map((e,i)=>`<tr><td style="border:1px solid #f0f0f0;padding:6px">${i+1}</td><td style="border:1px solid #f0f0f0;padding:6px;white-space:pre-wrap">${escapeHtml(e.input)}</td><td style="border:1px solid #f0f0f0;padding:6px;white-space:pre-wrap">${escapeHtml(e.output)}</td></tr>`).join('') || '<tr><td colspan=3 style="padding:8px;color:#8c8c8c">无样例</td></tr>'}</table>`;
    } else {
      preview.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-all;background:#fff;padding:8px;border:1px solid #f0f0f0;border-radius:6px;font-size:11px">${escapeHtml(JSON.stringify(lastParsed,null,2))}</pre>`;
    }
  }

  function doParse(){
    const md=document.getElementById('hoj-md').value.trim();
    if(!md){alert('请粘贴');return;}
    const p=parseMarkdown(md); lastParsed=p;
    if(!p.title){log('❌ 无标题','err');return;}
    log(`✓ 解析 ${p.examples.length} 组样例${p.sampleExplain?' + 样例解释':''}${p.hint?' + 提示':''}`,'ok');
    renderPreview(activeTab);
    log('预览已更新，确认后点创建','ok');
  }


  async function loadTags(token){
    if(tagLoaded) return allTagsFlat;
    if(tagLoading) return tagLoading;
    tagLoading=(async()=>{
      try{
        let r=await fetch('/api/get-problem-tags-and-classification?oj=ME',{headers:token?{'Authorization':token}:{},credentials:'include'}).then(r=>r.json());
        let groups=r.data?.data||r.data||[];
        allTagsFlat=[];
        for(let g of groups){
          let cls=(g.classification&&g.classification.name)||'未分类';
          for(let t of (g.tagList||[])) allTagsFlat.push({tag:t, cls});
        }
        tagLoaded=true;
        const si=document.getElementById('hoj-tag-search');
        if(si) si.placeholder=`🏷 搜索标签（共${allTagsFlat.length}个）…`;
        log(`🏷 标签库加载成功：${allTagsFlat.length} 个`,'ok');
      }catch(e){ log('🏷 标签库加载失败：'+e.message+'（可继续创建，标签留空）','err'); }
      return allTagsFlat;
    })();
    return tagLoading;
  }
  // 模糊匹配打分：精确=100 前缀=80 子串=60 子序列=20 不匹配=0
  function tagFuzzyScore(name,q){
    name=String(name||'').toLowerCase(); q=String(q||'').trim().toLowerCase();
    if(!q) return 1;
    if(name===q) return 100;
    if(name.startsWith(q)) return 80;
    if(name.includes(q)) return 60;
    let j=0; for(let i=0;i<name.length&&j<q.length;i++) if(name[i]===q[j]) j++;
    return j===q.length?20:0;
  }
  function searchTags(q){
    let res=[];
    for(let t of allTagsFlat){ let s=tagFuzzyScore(t.tag.name,q); if(s>0) res.push({t,s}); }
    res.sort((a,b)=> b.s-a.s || String(a.t.tag.name).length-String(b.t.tag.name).length);
    return res.slice(0,50).map(x=>x.t);
  }
  function renderTagDropdown(){
    const ipt=document.getElementById('hoj-tag-search'); if(!ipt) return;
    tagCurrentList=searchTags(ipt.value);
    tagActiveIndex=tagCurrentList.length?0:-1;
    paintTagDropdown();
  }
  function paintTagDropdown(){
    const dd=document.getElementById('hoj-tag-dropdown'); if(!dd) return;
    if(!tagCurrentList.length){ dd.style.display='none'; return; }
    dd.style.display='block';
    dd.innerHTML=tagCurrentList.map((t,i)=>{
      const sel=selectedTags.some(s=>s.tag.id===t.tag.id);
      return `<div data-i="${i}" style="padding:7px 10px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f7f7f7;${i===tagActiveIndex?'background:#e6f7ff;':''}${sel?'opacity:.55;':''}">`
        +`<span style="width:8px;height:8px;border-radius:50%;background:${t.tag.color||'#1890ff'};flex-shrink:0"></span>`
        +`<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.tag.name)}${sel?' ✓':''}</span>`
        +`<span style="color:#bfbfbf;font-size:11px;flex-shrink:0">${escapeHtml(t.cls)}</span></div>`;
    }).join('');
    dd.querySelectorAll('[data-i]').forEach(el=>{
      el.onmouseenter=()=>{ tagActiveIndex=parseInt(el.dataset.i); paintTagDropdown(); };
      el.onclick=()=>{ addTag(tagCurrentList[parseInt(el.dataset.i)]); };
    });
    const act=dd.querySelector(`[data-i="${tagActiveIndex}"]`); if(act) act.scrollIntoView({block:'nearest'});
  }
  function addTag(t){
    if(!t) return;
    if(selectedTags.some(s=>s.tag.id===t.tag.id)){ log(`🏷 已选过：${t.tag.name}`,'warn'); return; }
    selectedTags.push(t); renderTagChips();
    const si=document.getElementById('hoj-tag-search'); if(si){ si.value=''; si.focus(); }
    renderTagDropdown();
  }
  function renderTagChips(){
    const box=document.getElementById('hoj-tag-chips'), cnt=document.getElementById('hoj-tag-count');
    if(cnt) cnt.textContent=`已选 ${selectedTags.length}`;
    if(!box) return;
    if(!selectedTags.length){ box.style.display='none'; box.innerHTML=''; return; }
    box.style.display='flex'; box.innerHTML='';
    selectedTags.forEach(t=>{
      const c=document.createElement('span');
      c.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 8px;border-radius:12px;font-size:11px;background:#f5f5f5;color:#595959;border:1px solid #e8e8e8;max-width:100%';
      const dot=document.createElement('span'); dot.style.cssText=`width:7px;height:7px;border-radius:50%;background:${t.tag.color||'#1890ff'};flex-shrink:0`;
      const nm=document.createElement('span'); nm.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px'; nm.textContent=t.tag.name; nm.title=`${t.tag.name}（${t.cls}）`;
      const x=document.createElement('span'); x.textContent='✕'; x.style.cssText='cursor:pointer;color:#bfbfbf;padding:0 4px';
      x.onclick=()=>{ selectedTags=selectedTags.filter(s=>s.tag.id!==t.tag.id); renderTagChips(); paintTagDropdown(); };
      c.appendChild(dot); c.appendChild(nm); c.appendChild(x); box.appendChild(c);
    });
  }
  function hideTagDropdown(){ const dd=document.getElementById('hoj-tag-dropdown'); if(dd) dd.style.display='none'; }
  // 展示ID留空时自动分配：取最新100题中最大纯数字ID+1；无数字ID则用总数+1001
  async function autoProblemId(token){
    try{
      let r=await fetch('/api/admin/problem/get-problem-list?limit=100&currentPage=1',{headers:{'Authorization':token,'Url-Type':'admin'},credentials:'include'}).then(r=>r.json());
      let page=r.data?.data||r.data||{};
      let records=page.records||[];
      let max=0, found=false;
      for(let it of records){ let str=String(it.problemId||'').trim(); let n=parseInt(str,10); if(String(n)===str&&n>max){max=n;found=true;} }
      if(found) return String(max+1);
      let total=parseInt(page.total||0,10)||0;
      return String(total+1001);
    }catch(e){ return String(1001+Math.floor(Date.now()/1000)%899999); }
  }
  // 展示ID递增：纯数字直接+1；尾部数字保留前导零+1；无数字则追加1
  function nextProblemId(s){
    s=String(s||'');
    let m=s.match(/^(.*?)(\d+)$/);
    if(m){ let num=String(parseInt(m[2],10)+1); while(num.length<m[2].length) num='0'+num; return m[1]+num; }
    return (s||'P')+'1';
  }
  async function getUserInfo(token){
    try{
      let r=await fetch('/api/get-user-auth-info',{headers:{'Authorization':token}, credentials:'include'}).then(r=>r.json());
      let u = r.data?.data?.username || r.data?.username;
      if(u) return u;
    }catch(e){}
    try{ let s=localStorage.getItem('userInfo'); if(s){ let j=JSON.parse(s); return j.username||'曾谷优'; } }catch(e){}
    return '曾谷优';
  }

  async function doCreate(){
    if(!lastParsed) doParse();
    const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
    if(!token){log('❌ 无token','err');return;}
    let pid=document.getElementById('hoj-pid').value.trim();
    let pidAuto=false;
    if(!pid){ pid=await autoProblemId(token); pidAuto=true; document.getElementById('hoj-pid').value=pid; log(`展示ID留空，已自动分配：${pid}`,'ok'); }
    const auth=document.getElementById('hoj-auth').value;
    const difficulty=parseInt(document.getElementById('hoj-difficulty').value);
    const author = await getUserInfo(token);
    log(`用户: ${author} 难度: ${DIFFICULTY.find(d=>d.value===difficulty).label}(${difficulty}) 权限: ${auth==1?'公开':'私有'}`,'ok');
    // 语言：取全部 ME
    let all=[];
    try{
      let r=await fetch('/api/languages',{headers:{'Authorization':token},credentials:'include'}).then(r=>r.json());
      all=r.data?.data||r.data||[];
    }catch(e){}
    let langs = all.filter(l=> l.oj==='ME');
    if(!langs.length) langs = all.slice(0,13);
    log(`提交 ${langs.length} 种语言`,'ok');
    let desc = lastParsed.description || '暂无';
    let inp = lastParsed.input || '暂无';
    let out = lastParsed.output || '暂无';
    if(desc.length>60000) desc=desc.slice(0,60000);
    let exStr = examplesToString(lastParsed.examples);
    if(!exStr) exStr='<input>1</input><output>1</output>';
    // 样例同时写入 题面样例(examples) 与 评测数据(samples)
    // v1.7：score 改数字类型（后端 ProblemCase.score 为 Integer，与官方一致）
    let samples = lastParsed.examples.map((e,i)=> ({input:e.input, output:e.output, score:100, groupNum:1, pid:null, isOpen:true, index:i+1}));
    if(!samples.length) samples=[{input:"1",output:"1",score:100,groupNum:1,pid:null,isOpen:true,index:1}];
    log(`样例将写入：题面样例 ${lastParsed.examples.length} 组 + 评测数据 ${samples.length} 组`,'ok');
    log(`🏷 标签 ${selectedTags.length} 个${selectedTags.length?('：'+selectedTags.map(s=>s.tag.name).join('、')):''}`,'ok');
    log(`examples=${exStr.slice(0,200)}`);
    // 安全提示：官方格式不对样例内容做转义，若样例本身含 < > 会与标签冲突（官方页面同样如此）
    if(lastParsed.examples.some(e=>/[<>]/.test(e.input+e.output))){
      log('⚠ 样例内容含 < 或 >，可能干扰官方 <input>/<output> 解析，属官方格式固有限制','warn');
    }

    let payload={
      changeModeCode:true,
      problem:{
        id:null, problemId: pid||null, title:lastParsed.title, description:desc, input:inp, output:out,
        timeLimit:1000, memoryLimit:256, stackLimit:128, difficulty:difficulty, auth:parseInt(auth), codeShare:true,
        examples:exStr, spjLanguage:null, spjCode:null, spjCompileOk:false, isUploadCase:false, uploadTestcaseDir:"", testCaseScore:[], contestProblem:{}, type:1,
        hint:lastParsed.hint||'', source:"", cid:null, isRemoveEndBlank:true, openCaseResult:true, displayPartData:true,
        judgeMode:"default", judgeCaseMode:"default", userExtraFile:null, judgeExtraFile:null, isFileIO:false, ioReadFileName:null, ioWriteFileName:null, author:author
      },
      codeTemplates:[], tags:selectedTags.map(s=>s.tag), languages:langs, isUploadTestCase:false, uploadTestcaseDir:"", judgeMode:"default", samples:samples, changeJudgeCaseMode:true
    };
    console.log('FINAL PAYLOAD v2.1', payload);
    log(`POST /api/admin/problem 创建中：${payload.problem.title} ...`);
    let attempt=0, done=false;
    while(!done && attempt<12){
      attempt++;
      if(attempt>1){ payload.problem.problemId=nextProblemId(payload.problem.problemId); document.getElementById('hoj-pid').value=payload.problem.problemId; log(`展示ID冲突，自动递增重试(${attempt})：${payload.problem.problemId}`,'warn'); }
      try{
        let r=await fetch('/api/admin/problem',{method:'POST', headers:{'Content-Type':'application/json','Authorization':token,'Url-Type':'admin'}, credentials:'include', body:JSON.stringify(payload)});
        let txt=await r.text(); let j; try{j=JSON.parse(txt)}catch{j={raw:txt}}
        if(j && j.status===200){
          done=true;
          log(`返回 HTTP ${r.status} ${JSON.stringify(j).slice(0,800)}`,'ok');
          log(`🎉 创建成功！展示ID=${payload.problem.problemId}，题面样例与评测数据已同步写入`,'ok');
          alert('创建成功！\n'+payload.problem.title+'\n展示ID：'+payload.problem.problemId+'\n难度：'+DIFFICULTY.find(d=>d.value===difficulty).label+'\n权限：公开');
        } else {
          let em=(j&&j.msg)||txt.slice(0,300);
          if(pidAuto && /已存在/.test(em||'')){ log(`返回：${em}，自动换号重试…`,'warn'); continue; }
          log(`返回 HTTP ${r.status} ${JSON.stringify(j).slice(0,800)}`,'err');
          log('❌ 失败：'+em,'err'); alert('失败：'+em); break;
        }
      }catch(e){ log('异常 '+e.message,'err'); break; }
    }
    if(!done && attempt>=12){ log('❌ 展示ID自动递增12次仍冲突，请手动填写','err'); alert('失败：展示ID自动递增12次仍冲突，请手动填写展示ID后重试'); }
  }

  btn.onclick=createPanel;
  console.log('%c[HOJ v2.1] 已加载','color:#1890ff;font-weight:bold');
})();

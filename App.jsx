import { useState, useEffect, useRef } from "react";

/* =========================================================
   사이로그 — full app (not a scripted prototype)
   - Real persistent storage (browser localStorage)
   - Real AI (Claude API) powers chat parsing, quick analysis,
     deep reports, gift suggestions, SNS insight simulation
   - Full CRUD: add/edit/delete people & memories, real search/filter
   ========================================================= */

const COLORS = ["#B5556B", "#3F6B52", "#C98A3E", "#7C5C8C", "#4C7A9E", "#A85B3F"];
const CIRCLES = ["직장", "가족", "연애", "친구"];
const GOALS = ["더 친해지고 싶음", "지금 정도 유지", "업무적으로만 유지", "거리를 두고 싶음", "아직 모르겠음"];
const STORAGE_KEY = "cylog_app_state_v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function pickColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}
function safeParseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }
  return null;
}
async function callClaudeJSON(system, userText) {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        messages: [{ role: "user", content: userText }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return safeParseJSON(text);
  } catch (e) {
    return null;
  }
}

/* Small localStorage wrapper — mirrors the async shape used throughout the app */
const storage = {
  async get(key) {
    const v = window.localStorage.getItem(key);
    if (v === null) throw new Error("not found");
    return { value: v };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
    return { value };
  },
  async delete(key) {
    window.localStorage.removeItem(key);
    return { deleted: true };
  },
};

function defaultState() {
  return {
    onboarded: false,
    me: { nickname: "예원", job: "3년차 마케터", persona: { 직장: "", 연애: "", 친구: "" },
      circleImportance: { 직장: 80, 가족: 70, 연애: 60, 친구: 55 } },
    people: {},
    edges: {}, // key "a|b" (sorted ids) -> count
    subscription: false,
  };
}

function FoxIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M8 6 L15 17 L11 17 Z" fill="#EFA45C" />
      <path d="M32 6 L25 17 L29 17 Z" fill="#EFA45C" />
      <ellipse cx="20" cy="21" rx="13" ry="11" fill="#F2B378" />
      <path d="M9 27 Q20 36 31 27 Q26 32 20 32 Q14 32 9 27Z" fill="#FFF6EA" />
      <circle cx="15" cy="19" r="1.6" fill="#2B2438" />
      <circle cx="25" cy="19" r="1.6" fill="#2B2438" />
      <path d="M18.5 23 Q20 24.6 21.5 23" stroke="#2B2438" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const CSS = `
:root{
  --ink:#221D2E; --ink-soft:#6E6779; --ink-faint:#A79FB0;
  --bg:#F2ECDF; --card:#FFFFFF; --card-alt:#FBF5EA;
  --accent:#3E6B54; --accent-dark:#28453A; --accent-tint:#E3EEE6;
  --warm:#C1863C; --warm-tint:#F5E7CE;
  --tension:#AE5468; --tension-tint:#F4E1E5;
  --plum:#7C5C8C; --plum-dark:#5E4569; --plum-tint:#EFE6F2;
  --gold:#A8823D; --gold-tint:#F3E9D2;
  --line:#E3DBC7; --bezel-1:#332C41; --bezel-2:#161221;
  --shadow-sm:0 1px 2px rgba(34,29,46,.05);
  --shadow-md:0 10px 24px -14px rgba(34,29,46,.35);
}
*{box-sizing:border-box;}
.cy-root{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:var(--ink);
  display:flex;align-items:center;justify-content:center;min-height:100vh;
  background:radial-gradient(circle at 18% 12%,#3a3350 0%,transparent 42%),radial-gradient(circle at 88% 82%,#2c2540 0%,transparent 48%),#17131f;
  padding:32px 12px;}
.cy-phone{position:relative;width:390px;height:844px;background:linear-gradient(155deg,var(--bezel-1) 0%,var(--bezel-2) 65%);border-radius:54px;padding:13px;box-shadow:0 50px 90px -24px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.05) inset;}
.cy-screen{position:relative;width:100%;height:100%;background:var(--bg);border-radius:41px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px rgba(0,0,0,.25) inset;}
.cy-island{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:104px;height:30px;background:#000;border-radius:16px;z-index:210;}
.cy-home-indicator{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:126px;height:4px;border-radius:3px;background:rgba(34,29,46,.35);z-index:210;}
.cy-statusbar{height:40px;flex:0 0 auto;display:flex;align-items:flex-end;justify-content:space-between;padding:0 26px 7px;font-size:13px;font-weight:700;}
.cy-body{flex:1 1 auto;overflow-y:auto;padding:2px 20px 10px;position:relative;}
.cy-body::-webkit-scrollbar{display:none;}
h1.cy-title{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:12px 0 4px;}
.cy-sub{font-size:13px;color:var(--ink-soft);margin:0 0 16px;}
button{font-family:inherit;cursor:pointer;}
.pressable{transition:transform .12s ease;}
.pressable:active{transform:scale(.965);}
.cta-card{background:linear-gradient(150deg,var(--accent) 0%,var(--accent-dark) 100%);color:#fff;border-radius:22px;padding:18px;display:flex;align-items:center;gap:12px;border:none;width:100%;text-align:left;box-shadow:0 16px 30px -14px rgba(40,69,58,.55);}
.fox-badge{flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;}
.cta-k1{font-size:14.5px;font-weight:800;}
.cta-k2{font-size:12px;opacity:.85;}
.shortcuts{display:flex;gap:8px;margin:10px 0 4px;}
.chip-btn{flex:1;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 4px;font-size:12px;color:var(--ink-soft);font-weight:700;box-shadow:var(--shadow-sm);}
.section-label{font-size:14px;font-weight:800;margin:20px 0 9px;display:flex;align-items:center;justify-content:space-between;}
.see-all{font-size:12px;font-weight:700;color:var(--ink-faint);}
.card{background:var(--card);border-radius:18px;padding:15px 17px;border:1px solid var(--line);box-shadow:var(--shadow-sm);}
.card+.card{margin-top:10px;}
.briefing{display:flex;gap:11px;align-items:flex-start;background:var(--card-alt);border:1px dashed #D8CDB2;box-shadow:none;}
.briefing p{margin:0;font-size:13px;line-height:1.55;}
.hcards{display:flex;gap:9px;overflow-x:auto;margin:0 -20px;padding:0 20px 4px;}
.person-hcard{flex:0 0 auto;width:160px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:13px;box-shadow:var(--shadow-sm);}
.avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex:0 0 auto;}
.p-name{font-size:14.5px;font-weight:800;margin:8px 0 2px;}
.p-status{font-size:11.5px;font-weight:700;}
.p-status.down{color:var(--tension);}
.p-status.flat{color:var(--ink-faint);}
.p-status.up{color:var(--accent-dark);}
.filters{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;}
.filter-chip{flex:0 0 auto;padding:6px 13px;border-radius:100px;font-size:12px;font-weight:700;background:var(--card);border:1px solid var(--line);color:var(--ink-soft);}
.filter-chip.on{background:var(--ink);color:#fff;border-color:var(--ink);}
.search-input{width:100%;border:1px solid var(--line);background:var(--card);border-radius:100px;padding:10px 14px;font-size:13px;margin-bottom:10px;outline:none;}
.person-row{display:flex;align-items:center;gap:11px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 13px;margin-bottom:9px;box-shadow:var(--shadow-sm);}
.person-row .avatar{width:42px;height:42px;font-size:16px;}
.p-info{flex:1;min-width:0;}
.p-name-row{display:flex;align-items:center;gap:6px;}
.p-namesm{font-size:14px;font-weight:800;}
.p-circle{font-size:11px;color:var(--ink-faint);font-weight:600;}
.p-sub{font-size:11.5px;color:var(--ink-soft);margin-top:2px;}
.p-right{text-align:right;flex:0 0 auto;}
.p-imp{font-size:11px;font-weight:800;color:var(--accent-dark);}
.p-ev{font-size:10px;color:var(--ink-faint);margin-top:2px;}
.add-person-btn{width:100%;border:1px dashed var(--line);background:var(--card);border-radius:14px;padding:12px;font-size:12.5px;font-weight:700;color:var(--ink-soft);margin-bottom:10px;}
.graph-link{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px;padding:11px;border-radius:14px;background:var(--card);border:1px dashed var(--line);font-size:12px;font-weight:700;color:var(--plum-dark);}
.back-row{display:flex;align-items:center;justify-content:space-between;margin:8px 0 6px;}
.back-btn{width:32px;height:32px;border-radius:50%;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:var(--shadow-sm);}
.pd-head{display:flex;align-items:center;gap:11px;margin:6px 0 12px;}
.pd-head .avatar{width:52px;height:52px;font-size:19px;}
.pd-nm{font-size:19px;font-weight:800;}
.pd-circ{font-size:12px;color:var(--ink-soft);font-weight:600;}
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.dash-cell{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 13px;box-shadow:var(--shadow-sm);}
.dash-label{font-size:11px;color:var(--ink-faint);font-weight:700;}
.dash-val{font-size:15.5px;font-weight:800;margin-top:3px;}
.dash-val.down{color:var(--tension);}
.dash-val.up{color:var(--accent-dark);}
.talk-cta{margin-top:13px;width:100%;border:none;background:var(--ink);color:#fff;border-radius:15px;padding:13px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:var(--shadow-md);}
.completeness-wrap{margin-top:14px;}
.completeness-top{display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;}
.ctrack{height:6px;border-radius:4px;background:var(--line);position:relative;overflow:hidden;}
.cfill{position:absolute;top:0;left:0;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--accent),var(--accent-dark));transition:width .4s;}
.cnote{font-size:10.5px;color:var(--ink-faint);margin-top:5px;line-height:1.5;}
.goal-select{background:var(--accent-tint);color:var(--accent-dark);border:none;padding:7px 12px;border-radius:100px;font-size:12px;font-weight:700;}
.memory-item{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line);gap:8px;}
.memory-item:last-child{border-bottom:none;}
.m-label{font-size:11px;color:var(--ink-faint);font-weight:700;width:74px;flex:0 0 auto;}
.m-val{font-size:13px;flex:1;}
.m-val input{width:100%;border:1px solid var(--plum);border-radius:7px;padding:4px 7px;font-size:12.5px;font-family:inherit;outline:none;}
.m-actions{display:flex;gap:5px;flex:0 0 auto;}
.m-actions button{border:none;background:none;font-size:12px;color:var(--ink-faint);}
.add-memory-row{display:flex;gap:6px;margin-top:8px;}
.add-memory-row input{flex:1;border:1px solid var(--line);border-radius:9px;padding:7px 9px;font-size:12px;font-family:inherit;outline:none;}
.add-memory-row button{border:none;background:var(--ink);color:#fff;border-radius:9px;padding:0 12px;font-size:12px;font-weight:700;}
.timeline-item{display:flex;gap:11px;padding:3px 0 14px;}
.t-date{font-size:10.5px;color:var(--ink-faint);font-weight:700;}
.t-title{font-size:13px;font-weight:700;margin-top:1px;}
.t-emo{font-size:11px;color:var(--tension);margin-top:1px;}
.report-card{position:relative;overflow:hidden;}
.report-stats{display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
.rs{font-size:11px;color:var(--ink-faint);font-weight:600;}
.rs b{color:var(--ink);font-weight:800;}
.report-line{font-size:12.5px;line-height:1.6;}
.report-blur{filter:blur(4.5px);opacity:.75;}
.report-fade{position:absolute;left:0;right:0;bottom:0;height:60px;background:linear-gradient(180deg,rgba(255,255,255,0),var(--card) 85%);}
.report-cta{position:relative;z-index:2;margin-top:9px;width:100%;border:none;background:var(--ink);color:#fff;border-radius:13px;padding:11px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;}
.unlocked-badge{display:inline-flex;gap:6px;background:var(--accent-tint);color:var(--accent-dark);font-size:11px;font-weight:800;padding:5px 10px;border-radius:100px;margin-bottom:8px;}
.chat-header{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:6px 0 10px;}
.chat-header .avatar{width:36px;height:36px;font-size:14px;}
.chat-n{font-size:14px;font-weight:800;}
.chat-s{font-size:11px;color:var(--accent-dark);font-weight:600;}
.ctx-chip{display:inline-flex;align-items:center;gap:5px;background:var(--card);border:1px solid var(--line);border-radius:100px;padding:5px 10px 5px 6px;font-size:11.5px;font-weight:700;}
.ctx-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);}
.chat-scroll{flex:1 1 auto;overflow-y:auto;padding:2px 2px 6px;}
.msg-row{display:flex;margin-bottom:3px;gap:7px;}
.msg-row.user{justify-content:flex-end;}
.msg-row.bot .avatar{width:26px;height:26px;font-size:12px;flex:0 0 auto;}
.bubble{max-width:78%;padding:10px 13px;border-radius:17px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;}
.msg-row.bot .bubble{background:var(--card);border:1px solid var(--line);border-top-left-radius:5px;}
.msg-row.user .bubble{background:var(--ink);color:#fff;border-top-right-radius:5px;}
.toast-inline{text-align:center;font-size:11px;font-weight:700;color:var(--accent-dark);background:var(--accent-tint);padding:5px 11px;border-radius:100px;display:inline-block;margin:2px auto 12px;}
.toast-wrap{display:flex;justify-content:center;}
.analysis-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:13px 15px;margin:4px 0 12px;box-shadow:var(--shadow-sm);}
.a-title{font-size:13.5px;font-weight:800;margin-bottom:9px;}
.a-block{margin-bottom:9px;}
.a-label{font-size:10.5px;font-weight:800;color:var(--ink-faint);margin-bottom:3px;}
.a-body{font-size:12.5px;line-height:1.5;}
.hyp-item{display:flex;justify-content:space-between;gap:7px;font-size:12px;padding:5px 0;border-bottom:1px dashed var(--line);}
.conf{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:100px;flex:0 0 auto;}
.conf.낮음{background:#EFEAE0;color:var(--ink-faint);}
.conf.중간{background:var(--warm-tint);color:var(--warm);}
.conf.높음{background:var(--tension-tint);color:var(--tension);}
.quick-chips{display:flex;gap:6px;overflow-x:auto;padding:7px 0 9px;opacity:1;transition:opacity .2s;}
.qchip{flex:0 0 auto;padding:7px 12px;border-radius:100px;background:var(--card);border:1px solid var(--line);font-size:12px;font-weight:700;}
.attach-row{display:flex;gap:7px;padding:0 0 7px;overflow:hidden;max-height:0;opacity:0;transition:max-height .2s,opacity .2s;}
.attach-row.open{max-height:56px;opacity:1;}
.attach-opt{flex:1;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:8px 4px;font-size:11px;font-weight:700;color:var(--ink-soft);display:flex;flex-direction:column;align-items:center;gap:3px;}
.composer{display:flex;align-items:center;gap:7px;background:var(--card);border:1px solid var(--line);border-radius:100px;padding:7px;transition:opacity .2s;}
.plus-btn{width:32px;height:32px;border-radius:50%;border:none;background:var(--bg);color:var(--ink-soft);font-size:17px;font-weight:800;flex:0 0 auto;}
.composer input{flex:1;border:none;outline:none;background:none;font-size:13.5px;min-width:0;}
.send-btn{width:32px;height:32px;border-radius:50%;border:none;background:var(--ink);color:#fff;flex:0 0 auto;}
.typing-dots{display:flex;gap:4px;padding:5px 2px;}
.typing-dots span{width:6px;height:6px;border-radius:50%;background:var(--ink-faint);animation:blink 1.2s infinite ease-in-out;}
.typing-dots span:nth-child(2){animation-delay:.15s;}
.typing-dots span:nth-child(3){animation-delay:.3s;}
@keyframes blink{0%,80%,100%{opacity:.25;}40%{opacity:1;}}
.me-head{display:flex;align-items:center;gap:12px;margin:6px 0 16px;}
.me-head .avatar{width:52px;height:52px;font-size:19px;}
.persona-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);gap:9px;}
.persona-row:last-child{border-bottom:none;}
.p-circle-lbl{font-size:11px;font-weight:800;color:var(--ink-faint);width:44px;flex:0 0 auto;}
.p-desc{font-size:13px;flex:1;}
.p-desc input{width:100%;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:12.5px;font-family:inherit;outline:none;}
.plus-badge{font-size:9.5px;font-weight:800;color:var(--gold);background:var(--gold-tint);padding:2px 6px;border-radius:100px;margin-left:6px;}
.slider-row{margin:12px 0;}
.sr-top{display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:5px;}
.sr-top .num{color:var(--accent-dark);}
.track{height:6px;border-radius:4px;background:var(--line);position:relative;}
.fill{position:absolute;top:0;left:0;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--accent),var(--accent-dark));}
.navbar{flex:0 0 auto;display:grid;grid-template-columns:1fr 1fr 74px 1fr 1fr;align-items:center;padding:5px 6px 18px;background:linear-gradient(180deg,rgba(242,236,223,0),var(--bg) 32%);}
.navitem{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;padding:7px 2px;color:var(--ink-faint);font-size:10px;font-weight:700;}
.navitem svg{width:20px;height:20px;}
.navitem.active{color:var(--accent-dark);}
.navitem.active svg{stroke:var(--accent-dark);}
.nav-chat{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin:0 auto;transform:translateY(-13px);border-radius:50%;background:linear-gradient(155deg,var(--accent),var(--accent-dark));box-shadow:0 12px 24px -8px rgba(40,69,58,.6);border:4px solid var(--bg);}
.nav-chat.active{box-shadow:0 0 0 3px var(--warm),0 12px 24px -8px rgba(40,69,58,.6);}
.toast-host{position:absolute;left:0;right:0;bottom:90px;display:flex;justify-content:center;z-index:230;pointer-events:none;}
.gtoast{background:var(--ink);color:#fff;font-size:12px;font-weight:700;padding:9px 15px;border-radius:100px;box-shadow:var(--shadow-md);opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s;}
.gtoast.show{opacity:1;transform:translateY(0);}
.sheet-backdrop{position:absolute;inset:0;background:rgba(22,18,30,.5);opacity:0;pointer-events:none;transition:opacity .25s;z-index:150;border-radius:41px;}
.sheet-backdrop.open{opacity:1;pointer-events:auto;}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--bg);border-radius:24px 24px 0 0;padding:8px 18px 26px;transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.3,1);z-index:151;max-height:88%;overflow-y:auto;}
.sheet-backdrop.open .sheet{transform:translateY(0);}
.sheet-handle{width:36px;height:4px;border-radius:3px;background:var(--line);margin:5px auto 12px;}
.sheet-title{font-size:16px;font-weight:800;margin-bottom:4px;}
.sheet-sub{font-size:12px;color:var(--ink-soft);margin-bottom:14px;line-height:1.5;}
.primary-btn{width:100%;border:none;border-radius:14px;padding:13px;font-size:13.5px;font-weight:800;background:var(--ink);color:#fff;opacity:.4;pointer-events:none;}
.primary-btn.ready{opacity:1;pointer-events:auto;}
.secondary-btn{width:100%;text-align:center;background:none;border:none;color:var(--ink-faint);font-size:12px;font-weight:700;padding:11px;}
.field-label{font-size:11.5px;font-weight:700;color:var(--ink-soft);display:block;margin-bottom:5px;}
.text-input{width:100%;border:1.5px solid var(--line);background:var(--card);border-radius:13px;padding:11px 13px;font-size:13px;outline:none;margin-bottom:12px;font-family:inherit;}
.text-input:focus{border-color:var(--plum);}
.chip-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;}
.chip-opt{background:var(--card);border:1.5px solid var(--line);border-radius:13px;padding:10px 4px;text-align:center;font-size:11.5px;font-weight:700;color:var(--ink-soft);}
.chip-opt.sel{border-color:var(--plum);background:var(--plum-tint);color:var(--plum-dark);}
.loading-block{text-align:center;padding:26px 8px;}
.spin-badge{width:54px;height:54px;border-radius:50%;background:var(--plum-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;animation:pulseB 1.4s ease-in-out infinite;}
@keyframes pulseB{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}
.insight-tags{display:flex;flex-wrap:wrap;gap:6px;}
.sns-tag{font-size:11px;font-weight:700;background:var(--plum-tint);color:var(--plum-dark);padding:4px 9px;border-radius:100px;}
.gift-product{display:flex;gap:11px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:15px;padding:11px;margin-bottom:9px;}
.gp-emoji{width:40px;height:40px;border-radius:11px;background:var(--warm-tint);display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto;}
.gp-name{font-size:13px;font-weight:800;}
.gp-price{font-size:11px;color:var(--ink-faint);margin-top:2px;}
.gp-pick{border:none;background:var(--ink);color:#fff;font-size:11.5px;font-weight:700;border-radius:100px;padding:7px 11px;flex:0 0 auto;}
.overlay-page{position:absolute;inset:0;background:var(--bg);z-index:170;transform:translateX(100%);transition:transform .3s cubic-bezier(.2,.75,.3,1);display:flex;flex-direction:column;}
.overlay-page.active{transform:translateX(0);}
.overlay-header{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:14px 18px 6px;}
.overlay-ttl{font-size:15px;font-weight:800;}
.overlay-body{flex:1 1 auto;overflow-y:auto;padding:5px 18px 22px;}
.report-section{margin-bottom:17px;}
.rs-label{font-size:11.5px;font-weight:800;color:var(--gold);margin-bottom:6px;}
.rs-body{font-size:13px;line-height:1.6;}
.report-section ul{margin:0;padding-left:17px;}
.report-section li{font-size:13px;line-height:1.6;margin-bottom:4px;}
.dd-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.dd-col{border-radius:13px;padding:11px 13px;}
.dd-col.do{background:var(--accent-tint);}
.dd-col.dont{background:var(--tension-tint);}
.ddt{font-size:11px;font-weight:800;margin-bottom:5px;}
.dd-col.do .ddt{color:var(--accent-dark);}
.dd-col.dont .ddt{color:var(--tension);}
.dd-col li{font-size:11.5px;margin-bottom:4px;}
.plan-step{display:flex;gap:9px;margin-bottom:10px;}
.pn{width:20px;height:20px;border-radius:50%;background:var(--ink);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.pt{font-size:12.5px;line-height:1.5;padding-top:1px;}
.sub-hero{text-align:center;padding:14px 8px 4px;}
.sub-badge{width:52px;height:52px;border-radius:50%;background:var(--gold-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:22px;}
.sub-title{font-size:18px;font-weight:800;}
.sub-price{text-align:center;margin:5px 0 16px;}
.sub-amt{font-size:27px;font-weight:800;}
.sub-per{font-size:12px;color:var(--ink-faint);}
.sub-feature{display:flex;gap:9px;padding:10px 0;border-bottom:1px solid var(--line);font-size:12.5px;}
.sub-feature:last-child{border-bottom:none;}
.sub-cta{width:100%;border:none;background:linear-gradient(150deg,var(--gold),#8C6B2E);color:#fff;border-radius:15px;padding:14px;font-size:13.5px;font-weight:800;margin-top:16px;}
.mem-block{margin-bottom:18px;}
.mem-head{display:flex;align-items:center;gap:9px;margin-bottom:7px;}
.mem-head .avatar{width:28px;height:28px;font-size:12px;}
.mem-head-nm{font-size:13px;font-weight:800;}
.graph-legend{font-size:11px;color:var(--ink-faint);text-align:center;margin-top:6px;line-height:1.6;}
.empty-state{text-align:center;padding:30px 12px;}
.empty-state .t2{font-size:12px;color:var(--ink-soft);margin-top:10px;line-height:1.6;}
.sponsored-tag{font-size:10px;color:var(--ink-faint);font-weight:700;margin-top:8px;}
.reset-link{text-align:center;font-size:11px;color:var(--ink-faint);text-decoration:underline;margin-top:16px;}
`;

/* =========================================================
   Main App
   ========================================================= */
export default function App() {
  const [state, setState] = useState(defaultState());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [personDetailId, setPersonDetailId] = useState(null);
  const [chatFor, setChatFor] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatTyping, setChatTyping] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [sheet, setSheet] = useState(null); // {type:'sns'|'paywall'|'gift'|'addPerson', ...}
  const [overlay, setOverlay] = useState(null); // 'report'|'subscription'|'memory'|'graph'
  const [analysisCard, setAnalysisCard] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState("전체");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [ob, setOb] = useState({ step: 0, nickname: "", job: "", persona: [], personName: "", circle: "직장" });
  const chatScrollRef = useRef(null);
  const saveTimer = useRef(null);

  /* ---------- persistence ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setState({ ...defaultState(), ...parsed });
        }
      } catch (e) {
        // no saved state yet — fresh start
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storage.set(STORAGE_KEY, JSON.stringify(state), false).catch(() => {});
    }, 400);
  }, [state, loaded]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, chatTyping, analysisCard]);

  function showToast(msg) {
    const id = uid();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2200);
  }

  /* ---------- people helpers ---------- */
  function createPerson({ name, circle, detail = "", importance = 60, goal = "아직 모르겠음" }) {
    const id = uid();
    const person = {
      id, name, circle, detail, importance, goal,
      color: pickColor(name + id),
      initial: name.slice(0, 1),
      memory: [], timeline: [], sns: null,
      reportPurchased: false, deepReport: null,
      lastActive: todayLabel(),
    };
    setState(s => ({ ...s, people: { ...s.people, [id]: person } }));
    return id;
  }
  function updatePerson(id, patch) {
    setState(s => ({ ...s, people: { ...s.people, [id]: { ...s.people[id], ...patch } } }));
  }
  function addTimelineEvent(id, title, emo, sentiment) {
    setState(s => {
      const p = s.people[id];
      if (!p) return s;
      const ev = { id: uid(), date: todayLabel(), title, emo: emo || "", sentiment: sentiment || "neutral" };
      return { ...s, people: { ...s.people, [id]: { ...p, timeline: [ev, ...p.timeline], lastActive: todayLabel() } } };
    });
  }
  function addMemoryFact(id, val, label = "기록") {
    setState(s => {
      const p = s.people[id];
      if (!p) return s;
      const m = { id: uid(), label, val };
      return { ...s, people: { ...s.people, [id]: { ...p, memory: [...p.memory, m] } } };
    });
  }
  function deleteMemory(personId, memId) {
    setState(s => {
      const p = s.people[personId];
      if (!p) return s;
      return { ...s, people: { ...s.people, [personId]: { ...p, memory: p.memory.filter(m => m.id !== memId) } } };
    });
    showToast("기억 하나를 삭제했어");
  }
  function editMemory(personId, memId, val) {
    setState(s => {
      const p = s.people[personId];
      if (!p) return s;
      return { ...s, people: { ...s.people, [personId]: { ...p, memory: p.memory.map(m => m.id === memId ? { ...m, val } : m) } } };
    });
  }
  function recordEdge(idA, idB) {
    if (!idA || !idB || idA === idB) return;
    const key = [idA, idB].sort().join("|");
    setState(s => ({ ...s, edges: { ...s.edges, [key]: (s.edges[key] || 0) + 1 } }));
  }
  function findPersonIdByName(name) {
    if (!name) return null;
    const entries = Object.values(state.people);
    const exact = entries.find(p => p.name === name);
    if (exact) return exact.id;
    const partial = entries.find(p => name.includes(p.name) || p.name.includes(name));
    return partial ? partial.id : null;
  }

  /* computed heuristics */
  function personStats(p) {
    const recent = p.timeline.slice(0, 5);
    const neg = recent.filter(e => e.sentiment === "negative").length;
    const pos = recent.filter(e => e.sentiment === "positive").length;
    let tension = "낮음", tensionClass = "";
    if (recent.length >= 2 && neg > pos) { tension = "다소 높음"; tensionClass = "down"; }
    else if (recent.length >= 2 && neg === pos && neg > 0) { tension = "보통"; }
    const last3 = p.timeline.slice(0, 3);
    const prev3 = p.timeline.slice(3, 6);
    const score = arr => arr.reduce((a, e) => a + (e.sentiment === "positive" ? 1 : e.sentiment === "negative" ? -1 : 0), 0);
    let change = "→ 변화 없음", changeClass = "";
    if (last3.length) {
      const s1 = score(last3), s0 = score(prev3);
      if (s1 < s0) { change = "↘ 멀어지는 중"; changeClass = "down"; }
      else if (s1 > s0) { change = "↗ 가까워지는 중"; changeClass = "up"; }
    }
    const completeness = Math.min(95, 15 + p.memory.length * 9 + p.timeline.length * 4 + (p.sns ? 15 : 0));
    return { tension, tensionClass, change, changeClass, completeness };
  }

  /* ---------- AI: chat turn ---------- */
  async function sendChat(text) {
    if (!text.trim()) return;
    setChatMessages(m => [...m, { who: "user", text }]);
    setChatInput("");
    setChatTyping(true);
    const known = Object.values(state.people).map(p => p.name);
    const activeP = chatFor ? state.people[chatFor] : null;
    const contextLines = activeP
      ? `현재 대화 상대로 지정된 사람: ${activeP.name}\n최근 기록: ${activeP.timeline.slice(0, 3).map(t => `${t.title}(${t.emo || "-"})`).join(" / ") || "없음"}\n기억하고 있는 정보: ${activeP.memory.map(m => m.val).join(" / ") || "없음"}`
      : "현재 지정된 사람 없음.";
    const system = `당신은 "사이로그"라는 한국어 인간관계 기록 앱의 AI 캐릭터입니다. 사용자가 주변 사람과 있었던 일을 편하게 이야기하면, 공감하면서도 무조건 동조하지 않는 친근한 반말 톤으로 답하고, 대화 내용에서 구조화된 정보를 함께 추출합니다.
규칙: 상대의 속마음을 단정하지 말 것. 답변은 2~3문장, 너무 길지 않게. 반드시 아래 JSON 형식으로만 응답하고, 다른 설명이나 마크다운 코드블록은 절대 포함하지 마세요.
{"reply":"사용자에게 보여줄 한국어 답변","personName":"이번 대화의 중심 인물 이름(없으면 null)","isNewPerson":true또는false,"circleGuess":"직장|가족|연애|친구 중 하나","eventSummary":"이번에 있었던 일 한 줄 요약(없으면 null)","emotion":"사용자가 느낀 감정 한 단어(없으면 null)","sentiment":"positive|negative|neutral","newMemoryFact":"새롭게 알게 된 지속적 특징/관심사가 있으면 한 줄로(없으면 null)"}`;
    const userText = `[이미 알고 있는 사람들]: ${known.length ? known.join(", ") : "(아직 없음)"}\n[${contextLines}]\n\n사용자 메시지: ${text}`;
    const result = await callClaudeJSON(system, userText);
    setChatTyping(false);
    if (!result) {
      setChatMessages(m => [...m, { who: "bot", text: "음... 지금 생각이 잘 안 되네. 다시 한 번 말해줄래?" }]);
      return;
    }
    setChatMessages(m => [...m, { who: "bot", text: result.reply || "기억해둘게." }]);

    let pid = null;
    if (result.personName) {
      pid = findPersonIdByName(result.personName);
      if (!pid && result.isNewPerson) {
        pid = createPerson({ name: result.personName, circle: CIRCLES.includes(result.circleGuess) ? result.circleGuess : "직장" });
        showToast(`✓ ${result.personName}를 새로 기억했어`);
      }
    }
    if (!pid && chatFor) pid = chatFor;
    if (pid) {
      if (result.eventSummary) {
        addTimelineEvent(pid, result.eventSummary, result.emotion, result.sentiment);
        setChatMessages(m => [...m, { who: "toast", text: `✓ ${state.people[pid] ? state.people[pid].name : result.personName}에 대한 기억 1개 추가됨` }]);
      }
      if (result.newMemoryFact) addMemoryFact(pid, result.newMemoryFact, "특징");
      // co-mention edge detection: scan message text for other known people's names
      known.forEach(n => {
        if (n === (state.people[pid] && state.people[pid].name)) return;
        if (text.includes(n)) {
          const otherId = findPersonIdByName(n);
          if (otherId) recordEdge(pid, otherId);
        }
      });
      setChatFor(pid);
    }
  }

  function openChat(personId) {
    setChatFor(personId || null);
    setChatMessages(personId && state.people[personId]
      ? [{ who: "bot", text: `${state.people[personId].name} 얘기구나. 편하게 말해봐.` }]
      : [{ who: "bot", text: "오늘 무슨 일 있었어? 편하게 말해봐." }]);
    setAnalysisCard(null);
    setAttachOpen(false);
    setTab("chat");
  }

  /* ---------- AI: quick analysis ---------- */
  async function runQuickAnalysis() {
    const p = chatFor ? state.people[chatFor] : null;
    if (!p) { showToast("먼저 어떤 사람 이야기인지 말해줘"); return; }
    setChatMessages(m => [...m, { who: "user", text: "같이 분석해줘" }]);
    setChatTyping(true);
    const eventsText = p.timeline.slice(0, 8).map(t => `- ${t.date}: ${t.title} (감정:${t.emo || "-"}, 성격:${t.sentiment})`).join("\n") || "(기록된 사건 없음)";
    const memoryText = p.memory.map(m => `- ${m.label}: ${m.val}`).join("\n") || "(기록된 정보 없음)";
    const system = `당신은 "사이로그"의 관계 분석 엔진입니다. 아래 사람에 대한 기록을 바탕으로 분석하세요. 상대의 속마음을 단정하지 말고 가능성을 여러 개 제시하며, 반대 증거도 함께 찾아 균형을 잡으세요. 기록이 적으면 그 사실도 솔직히 반영하세요(과도한 확신 금지). 반드시 JSON만 응답하세요.
{"facts":"지금 확실한 사실 요약","hypotheses":[{"text":"가능한 해석","confidence":"낮음 또는 중간 또는 높음"}],"counterEvidence":"반대되는 신호","avoid":["지금 하지 말 것 1","2"],"actions":["추천 행동 1","2"]}`;
    const result = await callClaudeJSON(system, `[${p.name}에 대한 기록]\n${memoryText}\n\n[사건 기록]\n${eventsText}`);
    setChatTyping(false);
    if (!result) { setChatMessages(m => [...m, { who: "bot", text: "지금은 분석하기에 기록이 조금 부족한 것 같아." }]); return; }
    setChatMessages(m => [...m, { who: "bot", text: "네 기분은 이해돼. 근데 아직 단정하긴 일러 — 같이 정리해봤어." }]);
    setAnalysisCard(result);
  }

  async function quickReply(kind) {
    const p = chatFor ? state.people[chatFor] : null;
    if (kind === "analyze") { runQuickAnalysis(); return; }
    if (kind === "listen") { sendChat("그냥 들어줘"); return; }
    if (kind === "action") { sendChat("내가 어떻게 할까?"); return; }
    if (kind === "brief") { sendChat("만나기 전 브리핑해줘" + (p ? ` (${p.name})` : "")); return; }
  }

  /* ---------- AI: deep report ---------- */
  async function openPaywall(personId) {
    setSheet({ type: "paywall", personId });
  }
  async function processPurchase(personId) {
    setSheet({ type: "paywall-loading" });
    setReportLoading(true);
    const p = state.people[personId];
    const eventsText = p.timeline.map(t => `- ${t.date}: ${t.title} (감정:${t.emo || "-"}, 성격:${t.sentiment})`).join("\n") || "(기록된 사건 없음)";
    const memoryText = p.memory.map(m => `- ${m.label}: ${m.val}`).join("\n") || "(기록된 정보 없음)";
    const system = `당신은 "사이로그"의 심층 리포트 생성 엔진입니다. 아래 기록을 바탕으로 관계 심층 리포트를 만드세요. 단정적 표현을 피하고, 기록이 적으면 신중한 톤을 유지하세요. 반드시 JSON만 응답하세요.
{"traits":"관찰된 성향 2~3문장","patterns":["반복되는 패턴 1","2"],"positive":["긍정 신호 1","2"],"caution":["주의 신호 1","2"],"doList":["이렇게 해보세요 1","2"],"dontList":["이건 피하세요 1","2"],"plan":["30일 행동계획 1단계","2단계","3단계"]}`;
    const result = await callClaudeJSON(system, `[${p.name}에 대한 기록]\n${memoryText}\n\n[사건 기록]\n${eventsText}`);
    setReportLoading(false);
    updatePerson(personId, { reportPurchased: true, deepReport: result || {
      traits: "아직 기록이 충분하지 않아 일반적인 조언으로 대체합니다.", patterns: ["기록을 더 쌓으면 패턴이 보일 거예요"],
      positive: [], caution: [], doList: ["대화를 더 이어가며 기록을 쌓아보세요"], dontList: ["섣부른 판단은 피하세요"], plan: ["앞으로의 대화를 통해 천천히 알아가기"],
    } });
    setSheet(null);
    showToast("✓ 결제가 완료됐어");
    setOverlay({ type: "report", personId });
  }

  /* ---------- AI: gift suggestions ---------- */
  async function openGift(personId) {
    const p = state.people[personId];
    setSheet({ type: "gift-intro", personId });
  }
  async function loadGiftSuggestions(personId) {
    setSheet({ type: "gift-loading", personId });
    const p = state.people[personId];
    const interests = p.memory.map(m => m.val).join(", ") || "아직 알려진 관심사 없음";
    const system = `당신은 선물 추천 엔진입니다. 아래 사람의 알려진 관심사를 참고해 한국에서 구매 가능한 선물 3가지를 추천하세요. 반드시 JSON만 응답하세요.
{"suggestions":[{"emoji":"어울리는 이모지 1개","name":"선물 이름","price":"가격대(예: 25,000원)"},...]}`;
    const result = await callClaudeJSON(system, `관심사/기록: ${interests}`);
    setSheet({ type: "gift-result", personId, suggestions: (result && result.suggestions) || [
      { emoji: "🎁", name: "무드등", price: "19,000원" }, { emoji: "🍰", name: "디저트 세트", price: "25,000원" }, { emoji: "🌸", name: "작은 꽃다발", price: "22,000원" },
    ] });
  }

  /* ---------- AI: SNS insight (simulated public-info feature) ---------- */
  async function loadSnsInsight(personId, platform, url) {
    setSheet({ type: "sns-loading", personId });
    const p = state.people[personId];
    const system = `당신은 "사이로그"의 SNS 참고정보 기능입니다. 실제로 인터넷에 접속하지 않고, ${platform} 프로필을 가진 사람에게 일반적으로 있을 법한 공개적 관심사 카테고리와 대화 소재를 자연스럽게 만들어내는 시뮬레이션입니다(데모용 가상 데이터). 성격 진단이나 정치 성향 같은 민감한 내용은 만들지 마세요. 반드시 JSON만 응답하세요.
{"interests":["🎀 관심사1","🍰 관심사2","✈️ 관심사3"],"topics":["대화소재1","대화소재2"]}`;
    const result = await callClaudeJSON(system, `이름: ${p.name}, 이미 알려진 정보: ${p.memory.map(m => m.val).join(", ") || "없음"}`);
    setSheet({ type: "sns-result", personId, platform,
      data: result || { interests: ["🎀 취미", "🍰 음식", "✈️ 여행"], topics: ["요즘 관심사", "최근 다녀온 곳"] } });
  }
  function confirmAddSns(personId, platform, data) {
    updatePerson(personId, { sns: { platform, interests: data.interests, topics: data.topics } });
    setSheet(null);
    showToast(`✓ ${state.people[personId].name} SNS 정보가 기억에 추가됐어`);
  }

  /* ---------- onboarding ---------- */
  function finishOnboarding() {
    const nickname = ob.nickname.trim() || "나";
    const job = ob.job.trim();
    setState(s => ({ ...s, onboarded: true, me: { ...s.me, nickname, job } }));
    if (ob.personName.trim()) {
      const pid = createPerson({ name: ob.personName.trim(), circle: ob.circle, importance: 70 });
      setChatFor(pid);
    }
    setTab("home");
  }

  function resetApp() {
    storage.delete(STORAGE_KEY, false).catch(() => {});
    setState(defaultState());
    setOb({ step: 0, nickname: "", job: "", persona: [], personName: "", circle: "직장" });
    setTab("home");
    setPersonDetailId(null);
    setChatMessages([]);
    setOverlay(null);
    setSheet(null);
  }

  if (!loaded) {
    return (
      <div className="cy-root">
        <style>{CSS}</style>
        <div style={{ color: "#fff", fontSize: 13 }}>불러오는 중…</div>
      </div>
    );
  }

  const peopleArr = Object.values(state.people).sort((a, b) => (b.lastActive || "").localeCompare(a.lastActive || ""));
  const filteredPeople = peopleArr.filter(p => (peopleFilter === "전체" || p.circle === peopleFilter) && p.name.includes(peopleSearch));

  return (
    <div className="cy-root">
      <style>{CSS}</style>
      <div className="cy-phone">
        <div className="cy-island" />
        <div className="cy-screen">
          <div className="cy-statusbar"><span>9:41</span><span>사이로그</span></div>

          {!state.onboarded ? (
            <Onboarding ob={ob} setOb={setOb} onFinish={finishOnboarding} sendPreview={sendChat} />
          ) : (
            <>
              <div className="cy-body">
                {tab === "home" && (
                  <HomePage state={state} peopleArr={peopleArr} personStats={personStats}
                    onOpenPerson={(id) => { setPersonDetailId(id); setTab("person"); }}
                    onChat={() => openChat(peopleArr[0] ? peopleArr[0].id : null)}
                    onGift={(id) => openGift(id)} onSns={(id) => setSheet({ type: "sns", personId: id })}
                    onSeeAll={() => setTab("people")} />
                )}
                {tab === "people" && (
                  <PeoplePage filteredPeople={filteredPeople} peopleFilter={peopleFilter} setPeopleFilter={setPeopleFilter}
                    peopleSearch={peopleSearch} setPeopleSearch={setPeopleSearch} personStats={personStats}
                    onOpenPerson={(id) => { setPersonDetailId(id); setTab("person"); }}
                    onAddPerson={() => setSheet({ type: "addPerson" })}
                    onGraph={() => setOverlay({ type: "graph" })} />
                )}
                {tab === "person" && personDetailId && state.people[personDetailId] && (
                  <PersonDetailPage p={state.people[personDetailId]} stats={personStats(state.people[personDetailId])}
                    onBack={() => setTab("people")} onChat={() => openChat(personDetailId)}
                    onDeleteMemory={(mid) => deleteMemory(personDetailId, mid)}
                    onEditMemory={(mid, val) => editMemory(personDetailId, mid, val)}
                    onAddMemory={(val) => addMemoryFact(personDetailId, val, "직접 입력")}
                    onGoalChange={(g) => updatePerson(personDetailId, { goal: g })}
                    onOpenSns={() => setSheet({ type: "sns", personId: personDetailId })}
                    onOpenReport={() => setOverlay({ type: "report", personId: personDetailId })}
                    onOpenPaywall={() => openPaywall(personDetailId)} />
                )}
                {tab === "me" && (
                  <MePage state={state} setState={setState} onOpenSubscription={() => setOverlay({ type: "subscription" })}
                    onOpenMemory={() => setOverlay({ type: "memory" })} onReset={resetApp} />
                )}
              </div>

              {tab === "chat" && (
                <ChatPage chatFor={chatFor} state={state} chatMessages={chatMessages} chatTyping={chatTyping}
                  analysisCard={analysisCard} chatInput={chatInput} setChatInput={setChatInput}
                  attachOpen={attachOpen} setAttachOpen={setAttachOpen}
                  chatScrollRef={chatScrollRef} onSend={() => sendChat(chatInput)} onQuick={quickReply}
                  onSns={() => setSheet({ type: "sns", personId: chatFor })} />
              )}

              <NavBar tab={tab} setTab={(t) => { if (t === "chat") openChat(chatFor); else setTab(t); }} />

              <div className="toast-host">
                {toasts.map(t => <div key={t.id} className="gtoast show">{t.msg}</div>)}
              </div>

              <Sheet sheet={sheet} state={state} onClose={() => setSheet(null)}
                onCreatePerson={(data) => { const id = createPerson(data); setSheet(null); showToast(`✓ ${data.name}를 새로 등록했어`); setPersonDetailId(id); setTab("person"); }}
                onProcessPurchase={processPurchase} reportLoading={reportLoading}
                onLoadGift={loadGiftSuggestions} onPickGift={(name) => { setSheet(null); showToast(`✓ "${name}" 후보를 저장했어`); }}
                onLoadSnsInsight={loadSnsInsight} onConfirmSns={confirmAddSns} />

              {overlay && (
                <Overlay overlay={overlay} state={state} onClose={() => setOverlay(null)} onNavPerson={(id) => { setOverlay(null); setPersonDetailId(id); setTab("person"); }}
                  onSubscribe={() => { setState(s => ({ ...s, subscription: true })); showToast("✓ 사이로그 플러스 구독이 시작됐어"); setOverlay(null); }}
                  onDeleteMemory={deleteMemory} onEditMemory={editMemory} />
              )}
            </>
          )}

          <div className="cy-home-indicator" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Onboarding
   ========================================================= */
function Onboarding({ ob, setOb, onFinish, sendPreview }) {
  const steps = ["splash", "welcome", "privacy", "intro", "me", "persona", "person", "done"];
  const step = steps[ob.step];
  function next() { setOb(o => ({ ...o, step: Math.min(steps.length - 1, o.step + 1) })); }
  const personaOptions = ["일 잘하는 사람", "만만하지 않은 사람", "편한 사람", "믿을 만한 사람", "다정한 사람", "센스있는 사람"];

  return (
    <div className="overlay-page active" style={{ zIndex: 250 }}>
      <div className="overlay-header" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ width: i === ob.step ? 18 : 6, height: 6, borderRadius: 3, background: i <= ob.step ? "var(--accent)" : "var(--line)", transition: "width .2s" }} />
          ))}
        </div>
        <button className="secondary-btn" style={{ width: "auto", padding: "0 10px" }} onClick={onFinish}>건너뛰기</button>
      </div>
      <div className="overlay-body" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
        {step === "splash" && (
          <>
            <div style={{ margin: "0 auto 16px" }}><FoxIcon size={62} /></div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>사이로그</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8 }}>우리 사이를 기억하는 AI</div>
            <button className="primary-btn ready" style={{ marginTop: 32 }} onClick={next}>시작하기</button>
          </>
        )}
        {step === "welcome" && (
          <>
            <div style={{ margin: "0 auto 16px" }}><FoxIcon size={54} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6 }}>안녕. 사람 때문에<br />머리 복잡할 때<br />여기서 편하게 얘기해도 돼.</div>
            <button className="primary-btn ready" style={{ marginTop: 32 }} onClick={next}>다음</button>
          </>
        )}
        {step === "privacy" && (
          <>
            <div style={{ fontSize: 38, marginBottom: 14 }}>🔒</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>여기서 한 얘기는<br />소중하게 다룰게.</div>
            <div className="card" style={{ textAlign: "left" }}>
              {["기록은 안전하게 보호돼요", "언제든 직접 확인하고 수정할 수 있어요", "언제든 완전히 삭제할 수 있어요"].map(t => (
                <div key={t} className="persona-row"><span style={{ color: "var(--accent-dark)", marginRight: 8 }}>✓</span><div className="p-desc">{t}</div></div>
              ))}
            </div>
            <button className="primary-btn ready" style={{ marginTop: 18 }} onClick={next}>다음</button>
          </>
        )}
        {step === "intro" && (
          <>
            <div style={{ margin: "0 auto 16px" }}><FoxIcon size={54} /></div>
            <div className="card" style={{ textAlign: "left", fontSize: 13.5, lineHeight: 1.7 }}>
              나는 네 얘기를 기억해두고 인간관계가 헷갈릴 때 같이 보는 역할이야.<br /><br />
              네 편에서 들어줄게. 근데 무조건 네 말이 다 맞다곤 하진 않을 수도 있어.
            </div>
            <button className="primary-btn ready" style={{ marginTop: 18 }} onClick={next}>좋아, 시작할게</button>
          </>
        )}
        {step === "me" && (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>너에 대해 조금만 알려줘</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 16 }}>나중에 언제든 바꿀 수 있어</div>
            <label className="field-label">닉네임</label>
            <input className="text-input" value={ob.nickname} placeholder="예원" onChange={e => setOb(o => ({ ...o, nickname: e.target.value }))} />
            <label className="field-label">하는 일</label>
            <input className="text-input" value={ob.job} placeholder="3년차 마케터" onChange={e => setOb(o => ({ ...o, job: e.target.value }))} />
            <button className="primary-btn ready" onClick={next}>다음</button>
          </div>
        )}
        {step === "persona" && (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>사람들한테 어떤 사람으로<br />보이고 싶어?</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 16 }}>여러 개 골라도 돼</div>
            <div className="chip-grid">
              {personaOptions.map(o => (
                <div key={o} className={"chip-opt" + (ob.persona.includes(o) ? " sel" : "")}
                  onClick={() => setOb(s => ({ ...s, persona: s.persona.includes(o) ? s.persona.filter(x => x !== o) : [...s.persona, o] }))}>{o}</div>
              ))}
            </div>
            <button className="primary-btn ready" onClick={next}>다음</button>
          </div>
        )}
        {step === "person" && (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>요즘 제일 신경 쓰이는<br />사람 있어?</div>
            <label className="field-label">이름</label>
            <input className="text-input" value={ob.personName} placeholder="예: 민지" onChange={e => setOb(o => ({ ...o, personName: e.target.value }))} />
            <label className="field-label">어떤 사이야?</label>
            <div className="chip-grid">
              {CIRCLES.map(c => (
                <div key={c} className={"chip-opt" + (ob.circle === c ? " sel" : "")} onClick={() => setOb(o => ({ ...o, circle: c }))}>{c}</div>
              ))}
            </div>
            <button className="primary-btn ready" onClick={next}>다음</button>
          </div>
        )}
        {step === "done" && (
          <>
            <div style={{ margin: "0 auto 16px" }}><FoxIcon size={54} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6 }}>
              좋아, 이제 다 준비됐어.<br />{ob.personName || "그 사람"}한테 뭔가 있으면<br />편하게 얘기해.
            </div>
            <button className="primary-btn ready" style={{ marginTop: 32 }} onClick={onFinish}>홈으로 가기</button>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Home
   ========================================================= */
function HomePage({ state, peopleArr, personStats, onOpenPerson, onChat, onGift, onSns, onSeeAll }) {
  const top2 = peopleArr.slice(0, 2);
  const birthdayCandidate = peopleArr.find(p => p.memory.some(m => /생일|디저트|좋아/.test(m.val)));
  return (
    <>
      <h1 className="cy-title">{state.me.nickname}, 오늘은 어때?</h1>
      <p className="cy-sub">오늘 있었던 일을 편하게 이야기해봐</p>
      <button className="cta-card pressable" onClick={onChat}>
        <span className="fox-badge"><FoxIcon size={22} /></span>
        <span style={{ flex: 1 }}><div className="cta-k1">오늘 무슨 일 있었어?</div><div className="cta-k2">캐릭터에게 얘기하기</div></span>
        <span style={{ opacity: .85 }}>→</span>
      </button>
      <div className="shortcuts">
        <button className="chip-btn pressable" onClick={onChat}>📷 사진</button>
        <button className="chip-btn pressable" onClick={() => top2[0] && onSns(top2[0].id)}>🔗 SNS</button>
        <button className="chip-btn pressable" onClick={onChat}>🎙️ 음성</button>
      </div>

      {peopleArr.length === 0 ? (
        <div className="empty-state">
          <div style={{ margin: "0 auto" }}><FoxIcon size={44} /></div>
          <div className="t2">아직 아무도 등록되지 않았어.<br />위에서 오늘 있었던 일을 편하게 얘기해봐.<br />사람이 언급되면 자동으로 기억할게.</div>
        </div>
      ) : (
        <>
          <div className="section-label"><span>최근 신경 쓰이는 사람</span><span className="see-all" onClick={onSeeAll}>전체보기</span></div>
          <div className="hcards">
            {top2.map(p => {
              const st = personStats(p);
              return (
                <div key={p.id} className="person-hcard pressable" onClick={() => onOpenPerson(p.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div className="avatar" style={{ background: p.color }}>{p.initial}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-faint)" }}>중요도 {p.importance}</div>
                  </div>
                  <div className="p-name">{p.name}</div>
                  <div className={"p-status " + (st.changeClass || "flat")}>{st.change}</div>
                </div>
              );
            })}
          </div>
          {birthdayCandidate && (
            <>
              <div className="section-label"><span>오늘의 관계 브리핑</span></div>
              <div className="card briefing pressable" style={{ cursor: "pointer" }} onClick={() => onGift(birthdayCandidate.id)}>
                <span className="fox-badge" style={{ background: "var(--warm-tint)" }}>🎂</span>
                <p>{birthdayCandidate.name}에게 어울릴 선물, 같이 골라볼까?</p>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

/* =========================================================
   People
   ========================================================= */
function PeoplePage({ filteredPeople, peopleFilter, setPeopleFilter, peopleSearch, setPeopleSearch, personStats, onOpenPerson, onAddPerson, onGraph }) {
  return (
    <>
      <h1 className="cy-title">내 사람들</h1>
      <p className="cy-sub">이야기했던 사람들을 사이로그가 기억하고 있어</p>
      <input className="search-input" placeholder="이름으로 검색" value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} />
      <div className="filters">
        {["전체", ...CIRCLES].map(c => (
          <div key={c} className={"filter-chip" + (peopleFilter === c ? " on" : "")} onClick={() => setPeopleFilter(c)}>{c}</div>
        ))}
      </div>
      <button className="add-person-btn pressable" onClick={onAddPerson}>+ 새 사람 직접 추가하기</button>
      {filteredPeople.length === 0 ? (
        <div className="empty-state"><div className="t2">조건에 맞는 사람이 없어.</div></div>
      ) : filteredPeople.map(p => {
        const st = personStats(p);
        return (
          <div key={p.id} className="person-row pressable" onClick={() => onOpenPerson(p.id)}>
            <div className="avatar" style={{ background: p.color }}>{p.initial}</div>
            <div className="p-info">
              <div className="p-name-row"><span className="p-namesm">{p.name}</span><span className="p-circle">{p.circle}</span></div>
              <div className="p-sub">{st.change} · 최근 기록 {p.lastActive || "-"}</div>
            </div>
            <div className="p-right"><div className="p-imp">{p.importance}</div><div className="p-ev">Event {p.timeline.length}개</div></div>
          </div>
        );
      })}
      <div className="graph-link pressable" onClick={onGraph}>🕸️ 사람과 사람 사이 관계망 보기</div>
    </>
  );
}

/* =========================================================
   Person Detail
   ========================================================= */
function PersonDetailPage({ p, stats, onBack, onChat, onDeleteMemory, onEditMemory, onAddMemory, onGoalChange, onOpenSns, onOpenReport, onOpenPaywall }) {
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [newMemo, setNewMemo] = useState("");
  return (
    <>
      <div className="back-row"><div className="back-btn pressable" onClick={onBack}>‹</div></div>
      <div className="pd-head">
        <div className="avatar" style={{ background: p.color }}>{p.initial}</div>
        <div><div className="pd-nm">{p.name}</div><div className="pd-circ">{p.circle}{p.detail ? " · " + p.detail : ""}</div></div>
      </div>
      <div className="dash-grid">
        <div className="dash-cell"><div className="dash-label">내게 중요한 정도</div><div className="dash-val">{p.importance} / 100</div></div>
        <div className="dash-cell"><div className="dash-label">최근 변화</div><div className={"dash-val " + (stats.changeClass || "")}>{stats.change}</div></div>
        <div className="dash-cell"><div className="dash-label">긴장도</div><div className={"dash-val " + (stats.tensionClass || "")}>{stats.tension}</div></div>
        <div className="dash-cell"><div className="dash-label">기록된 사건</div><div className="dash-val">{p.timeline.length}건</div></div>
      </div>
      <button className="talk-cta pressable" onClick={onChat}><FoxIcon size={17} /> {p.name} 얘기하기</button>

      <div className="completeness-wrap">
        <div className="completeness-top"><span style={{ color: "var(--ink-soft)" }}>{p.name}에 대해 현재</span><b style={{ color: "var(--accent-dark)" }}>{stats.completeness}%</b></div>
        <div className="ctrack"><div className="cfill" style={{ width: stats.completeness + "%" }} /></div>
        <p className="cnote">사이로그가 활용할 수 있는 프로필 데이터의 완성도예요. {p.name}를 다 이해했다는 뜻은 아니에요.</p>
      </div>

      <div className="section-label"><span>관계 목표</span></div>
      <select className="goal-select" value={p.goal} onChange={e => onGoalChange(e.target.value)}>
        {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <div className="section-label"><span>내가 기억하고 있는 {p.name}</span></div>
      <div className="card">
        {p.memory.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>아직 기록된 정보가 없어. 대화하면서 자연스럽게 쌓일 거야.</div>}
        {p.memory.map(m => (
          <div className="memory-item" key={m.id}>
            <div className="m-label">{m.label}</div>
            <div className="m-val">
              {editingId === m.id ? (
                <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                  onBlur={() => { onEditMemory(m.id, editVal); setEditingId(null); }}
                  onKeyDown={e => { if (e.key === "Enter") { onEditMemory(m.id, editVal); setEditingId(null); } }} />
              ) : m.val}
            </div>
            <div className="m-actions">
              <button onClick={() => { setEditingId(m.id); setEditVal(m.val); }}>✎</button>
              <button onClick={() => onDeleteMemory(m.id)}>🗑</button>
            </div>
          </div>
        ))}
        <div className="add-memory-row">
          <input placeholder="직접 기억 추가하기" value={newMemo} onChange={e => setNewMemo(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newMemo.trim()) { onAddMemory(newMemo.trim()); setNewMemo(""); } }} />
          <button onClick={() => { if (newMemo.trim()) { onAddMemory(newMemo.trim()); setNewMemo(""); } }}>추가</button>
        </div>
      </div>

      <div className="section-label"><span>공개 프로필 (SNS)</span></div>
      <div className="card">
        {p.sns ? (
          <div style={{ display: "flex", gap: 11 }}>
            <div className="fox-badge" style={{ background: "var(--plum-tint)" }}>🔗</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{p.sns.platform}</div>
              <div className="insight-tags" style={{ marginTop: 7 }}>{p.sns.interests.map((t, i) => <span key={i} className="sns-tag">{t}</span>)}</div>
              <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: "var(--plum-dark)", cursor: "pointer" }} onClick={onOpenSns}>다시 확인하기</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 11 }}>
              <div className="fox-badge" style={{ background: "var(--plum-tint)" }}>🔗</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", flex: 1 }}>아직 연결된 공개 프로필이 없어. 추가하면 대화 소재를 참고할 수 있어.</div>
            </div>
            <button className="secondary-btn pressable" style={{ background: "var(--plum-tint)", color: "var(--plum-dark)", borderRadius: 12, marginTop: 10, fontWeight: 800 }} onClick={onOpenSns}>+ SNS 추가하기</button>
          </>
        )}
      </div>

      <div className="section-label"><span>우리에게 있었던 일</span></div>
      {p.timeline.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>아직 기록된 사건이 없어.</div>}
      {p.timeline.map((t, i) => (
        <div className="timeline-item" key={t.id}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, background: i === 0 ? "var(--accent)" : "var(--ink-faint)" }} />
          <div><div className="t-date">{t.date}</div><div className="t-title">{t.title}</div>{t.emo && <div className="t-emo">감정 · {t.emo}</div>}</div>
        </div>
      ))}

      <div className="section-label"><span>심층 리포트</span></div>
      <div className="card report-card pressable" onClick={() => p.reportPurchased ? onOpenReport() : onOpenPaywall()}>
        {p.reportPurchased ? (
          <>
            <div className="unlocked-badge">✓ 구매 완료</div>
            <div className="report-line">{p.name}의 심층 리포트를 전체 확인할 수 있어.</div>
            <button className="report-cta" style={{ position: "static" }}>{p.name} 심층 리포트 다시 보기</button>
          </>
        ) : (
          <>
            <div className="report-stats"><span className="rs">Event <b>{p.timeline.length}</b></span><span className="rs">기억 <b>{p.memory.length}</b></span><span className="rs">SNS <b>{p.sns ? "O" : "X"}</b></span></div>
            <div className="report-line">{p.timeline.length < 2 ? "기록이 조금 더 쌓이면 훨씬 정확한 리포트를 볼 수 있어." : "반복되는 패턴을 심층 리포트에서 확인할 수 있어."}</div>
            <button className="report-cta">{p.name} 관계 심층 분석 보기 <span style={{ fontSize: 11, opacity: .8 }}>₩3,900</span></button>
          </>
        )}
      </div>
      <div style={{ height: 20 }} />
    </>
  );
}

/* =========================================================
   Chat
   ========================================================= */
function ChatPage({ chatFor, state, chatMessages, chatTyping, analysisCard, chatInput, setChatInput, attachOpen, setAttachOpen, chatScrollRef, onSend, onQuick, onSns }) {
  const person = chatFor ? state.people[chatFor] : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "0 20px 10px" }}>
      <div className="chat-header">
        <div className="avatar" style={{ background: "var(--accent-dark)" }}><FoxIcon size={15} /></div>
        <div style={{ flex: 1 }}><div className="chat-n">사이로그</div><div className="chat-s">{person ? `${person.name} 이야기를 기억하고 있어` : "편하게 이야기해봐"}</div></div>
        {person && <span className="ctx-chip"><span className="ctx-dot" />{person.name}</span>}
      </div>
      <div className="chat-scroll" ref={chatScrollRef}>
        {chatMessages.map((m, i) => m.who === "toast" ? (
          <div className="toast-wrap" key={i}><span className="toast-inline">{m.text}</span></div>
        ) : (
          <div className={"msg-row " + m.who} key={i}>
            {m.who === "bot" && <span className="avatar" style={{ background: "var(--accent-dark)" }}><FoxIcon size={13} /></span>}
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {chatTyping && (
          <div className="msg-row bot"><span className="avatar" style={{ background: "var(--accent-dark)" }}><FoxIcon size={13} /></span>
            <div className="bubble"><div className="typing-dots"><span /><span /><span /></div></div></div>
        )}
        {analysisCard && <AnalysisCard a={analysisCard} />}
      </div>
      <div className="quick-chips">
        <div className="qchip" onClick={() => onQuick("listen")}>그냥 들어줘</div>
        <div className="qchip" onClick={() => onQuick("analyze")}>같이 분석해줘</div>
        <div className="qchip" onClick={() => onQuick("action")}>내가 어떻게 할까?</div>
        <div className="qchip" onClick={() => onQuick("brief")}>만나기 전 브리핑</div>
      </div>
      <div className={"attach-row" + (attachOpen ? " open" : "")}>
        <div className="attach-opt" onClick={() => setAttachOpen(false)}>📷<span>스크린샷</span></div>
        <div className="attach-opt" onClick={() => { setAttachOpen(false); onSns(); }}>🔗<span>SNS</span></div>
        <div className="attach-opt" onClick={() => setAttachOpen(false)}>✏️<span>직접 정보</span></div>
      </div>
      <div className="composer">
        <button className="plus-btn" onClick={() => setAttachOpen(o => !o)}>+</button>
        <input placeholder="편하게 얘기해봐…" value={chatInput} onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSend(); }} />
        <button className="send-btn" onClick={onSend}>↑</button>
      </div>
    </div>
  );
}

function AnalysisCard({ a }) {
  return (
    <div className="analysis-card">
      <div className="a-title">🔎 내가 보기엔 이래</div>
      <div className="a-block"><div className="a-label">지금 확실한 것</div><div className="a-body">{a.facts}</div></div>
      <div className="a-block">
        <div className="a-label">가능한 해석</div>
        {(a.hypotheses || []).map((h, i) => (
          <div className="hyp-item" key={i}><span>{h.text}</span><span className={"conf " + h.confidence}>{h.confidence}</span></div>
        ))}
      </div>
      {a.counterEvidence && <div className="a-block"><div className="a-label">반대 신호</div><div className="a-body" style={{ color: "var(--ink-soft)" }}>{a.counterEvidence}</div></div>}
      <div className="a-block"><div className="a-label">지금 하지 말 것</div><ul>{(a.avoid || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      <div className="a-block"><div className="a-label">추천하는 다음 행동</div><ul>{(a.actions || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
    </div>
  );
}

/* =========================================================
   Me
   ========================================================= */
function MePage({ state, setState, onOpenSubscription, onOpenMemory, onReset }) {
  function setPersona(circle, val) {
    setState(s => ({ ...s, me: { ...s.me, persona: { ...s.me.persona, [circle]: val } } }));
  }
  function setCircleImp(circle, val) {
    setState(s => ({ ...s, me: { ...s.me, circleImportance: { ...s.me.circleImportance, [circle]: val } } }));
  }
  return (
    <>
      <h1 className="cy-title">나</h1>
      <div className="me-head">
        <div className="avatar" style={{ background: "var(--ink)" }}>{state.me.nickname.slice(0, 1)}</div>
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>{state.me.nickname}</div><div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{state.me.job}</div></div>
      </div>

      <div className="section-label"><span>구독</span></div>
      <div className="card">
        <div className="persona-row pressable" style={{ cursor: "pointer" }} onClick={onOpenSubscription}>
          <div className="p-desc">사이로그 플러스{state.subscription && <span className="plus-badge">구독중</span>}</div>
          <div>›</div>
        </div>
      </div>

      <div className="section-label"><span>내가 되고 싶은 사람 (Persona)</span></div>
      <div className="card">
        {CIRCLES.filter(c => c !== "가족").map(c => (
          <div className="persona-row" key={c}>
            <div className="p-circle-lbl">{c}</div>
            <div className="p-desc"><input placeholder="어떤 사람이고 싶어?" value={state.me.persona[c] || ""} onChange={e => setPersona(c, e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div className="section-label"><span>Circle Importance</span></div>
      <div className="card">
        {CIRCLES.map(c => (
          <div className="slider-row" key={c}>
            <div className="sr-top"><span>{c}</span><span className="num">{state.me.circleImportance[c]}</span></div>
            <input type="range" min="0" max="100" value={state.me.circleImportance[c]} style={{ width: "100%" }}
              onChange={e => setCircleImp(c, Number(e.target.value))} />
          </div>
        ))}
        <p className="cnote">이 영역은 내 삶에 얼마나 큰 영향을 미치는가를 뜻해요. 좋아하는 정도와는 달라요.</p>
      </div>

      <div className="section-label"><span>설정</span></div>
      <div className="card">
        <div className="persona-row pressable" style={{ cursor: "pointer" }} onClick={onOpenMemory}><div className="p-desc">AI Memory 확인 · 수정 · 삭제</div><div>›</div></div>
        <div className="persona-row"><div className="p-desc">알림</div><div>›</div></div>
        <div className="persona-row"><div className="p-desc">개인정보 보호</div><div>›</div></div>
      </div>
      <div className="reset-link" onClick={onReset}>모든 데이터 초기화하고 처음부터 다시 시작하기</div>
      <div style={{ height: 20 }} />
    </>
  );
}

/* =========================================================
   Nav bar
   ========================================================= */
function NavBar({ tab, setTab }) {
  const Icon = {
    home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>,
    people: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c.6-3.4 3.2-5.4 6.2-5.4s5.6 2 6.2 5.4" /><circle cx="17" cy="8" r="2.4" /><path d="M15.5 13.8c2.4.3 4.2 2.1 4.7 4.8" /></svg>,
    me: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1-4 4-6.2 7.5-6.2s6.5 2.2 7.5 6.2" /></svg>,
  };
  return (
    <div className="navbar">
      <button className={"navitem" + (tab === "home" ? " active" : "")} onClick={() => setTab("home")}>{Icon.home}홈</button>
      <button className={"navitem" + (tab === "people" || tab === "person" ? " active" : "")} onClick={() => setTab("people")}>{Icon.people}사람</button>
      <button className={"nav-chat" + (tab === "chat" ? " active" : "")} onClick={() => setTab("chat")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5h16v10H9l-4 4v-4H4z" /></svg>
      </button>
      <button className={"navitem" + (tab === "me" ? " active" : "")} onClick={() => setTab("me")}>{Icon.me}나</button>
      <div />
    </div>
  );
}

/* =========================================================
   Bottom sheets (SNS / Paywall / Gift / Add Person)
   ========================================================= */
function Sheet({ sheet, state, onClose, onCreatePerson, onProcessPurchase, reportLoading, onLoadGift, onPickGift, onLoadSnsInsight, onConfirmSns }) {
  const [form, setForm] = useState({ name: "", circle: "직장", detail: "", importance: 60, goal: "아직 모르겠음" });
  const [platform, setPlatform] = useState(null);
  const [url, setUrl] = useState("");

  if (!sheet) return <div className="sheet-backdrop"><div className="sheet" /></div>;
  const open = true;
  const person = sheet.personId ? state.people[sheet.personId] : null;

  let content = null;

  if (sheet.type === "addPerson") {
    content = (
      <>
        <div className="sheet-handle" /><div className="sheet-title">새 사람 추가</div>
        <label className="field-label">이름</label>
        <input className="text-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="이름" />
        <label className="field-label">어떤 사이야?</label>
        <div className="chip-grid">{CIRCLES.map(c => <div key={c} className={"chip-opt" + (form.circle === c ? " sel" : "")} onClick={() => setForm(f => ({ ...f, circle: c }))}>{c}</div>)}</div>
        <label className="field-label">세부 관계 (선택)</label>
        <input className="text-input" value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} placeholder="예: 전 부사수" />
        <label className="field-label">내게 얼마나 중요한 사람이야? ({form.importance})</label>
        <input type="range" min="0" max="100" value={form.importance} style={{ width: "100%", marginBottom: 14 }} onChange={e => setForm(f => ({ ...f, importance: Number(e.target.value) }))} />
        <button className={"primary-btn" + (form.name.trim() ? " ready" : "")} onClick={() => onCreatePerson(form)}>추가하기</button>
        <button className="secondary-btn" onClick={onClose}>취소</button>
      </>
    );
  } else if (sheet.type === "paywall" && person) {
    content = (
      <>
        <div className="sheet-handle" /><div className="sheet-title">{person.name} 관계 심층 리포트</div>
        <div className="sheet-sub">Event {person.timeline.length}개 · 기억 {person.memory.length}개를 바탕으로 만들어요.</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 16px" }}><span style={{ fontSize: 24, fontWeight: 800 }}>₩3,900</span><span style={{ fontSize: 12, color: "var(--ink-faint)" }}>1회 결제 · 평생 소장</span></div>
        <button className="primary-btn ready" onClick={() => onProcessPurchase(sheet.personId)}>결제하고 전체 보기</button>
        <button className="secondary-btn" onClick={onClose}>다음에 볼게</button>
      </>
    );
  } else if (sheet.type === "paywall-loading") {
    content = (
      <>
        <div className="sheet-handle" />
        <div className="loading-block"><div className="spin-badge" style={{ background: "var(--accent-tint)" }}>💳</div><p style={{ fontSize: 13 }}>{reportLoading ? "AI가 리포트를 만들고 있어…" : "결제를 확인하고 있어…"}</p></div>
      </>
    );
  } else if (sheet.type === "gift-intro" && person) {
    content = (
      <>
        <div className="sheet-handle" /><div className="sheet-title">{person.name}에게 줄 선물</div>
        <div className="sheet-sub">기억해둔 정보: {person.memory.map(m => m.val).join(" · ") || "아직 없음"}</div>
        <button className="primary-btn ready" onClick={() => onLoadGift(sheet.personId)}>선물 추천받기</button>
        <button className="secondary-btn" onClick={onClose}>나중에</button>
      </>
    );
  } else if (sheet.type === "gift-loading") {
    content = <><div className="sheet-handle" /><div className="loading-block"><div className="spin-badge">🎁</div><p style={{ fontSize: 13 }}>어울리는 선물을 고르고 있어…</p></div></>;
  } else if (sheet.type === "gift-result" && person) {
    content = (
      <>
        <div className="sheet-handle" /><div className="sheet-title">{person.name}에게는 이런 게 어때?</div>
        {sheet.suggestions.map((g, i) => (
          <div className="gift-product" key={i}>
            <div className="gp-emoji">{g.emoji}</div>
            <div style={{ flex: 1 }}><div className="gp-name">{g.name}</div><div className="gp-price">{g.price}</div></div>
            <button className="gp-pick" onClick={() => onPickGift(g.name)}>이걸로 할게</button>
          </div>
        ))}
        <div className="sponsored-tag">제휴 상품 · 사이로그가 광고 목적으로 데이터를 외부에 제공하지 않아요.</div>
        <button className="secondary-btn" onClick={onClose}>닫기</button>
      </>
    );
  } else if (sheet.type === "sns" && person) {
    content = (
      <>
        <div className="sheet-handle" /><div className="sheet-title">{person.name}의 SNS</div>
        <div className="sheet-sub">공개 프로필이 있다면 관심사 같은 걸 참고할 수 있어. (데모: 실제 URL을 방문하지 않고, AI가 그럴듯한 참고 정보를 생성해요)</div>
        <div className="chip-grid">
          {["Instagram", "Threads", "TikTok", "블로그"].map(pf => (
            <div key={pf} className={"chip-opt" + (platform === pf ? " sel" : "")} onClick={() => setPlatform(pf)}>{pf}</div>
          ))}
        </div>
        <label className="field-label">프로필 URL</label>
        <input className="text-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="예: instagram.com/xxxxx" />
        <button className={"primary-btn" + (platform && url.trim().length > 2 ? " ready" : "")} onClick={() => onLoadSnsInsight(sheet.personId, platform, url)}>공개 정보 참고하기</button>
        <button className="secondary-btn" onClick={onClose}>나중에</button>
      </>
    );
  } else if (sheet.type === "sns-loading") {
    content = <><div className="sheet-handle" /><div className="loading-block"><div className="spin-badge">🔍</div><p style={{ fontSize: 13 }}>공개적으로 올린 정보를 참고하고 있어…</p></div></>;
  } else if (sheet.type === "sns-result" && person) {
    content = (
      <>
        <div className="sheet-handle" /><div className="sheet-title">공개 프로필에서 이런 게 보여</div>
        <div className="a-label" style={{ marginBottom: 8 }}>자주 등장하는 관심사</div>
        <div className="insight-tags" style={{ marginBottom: 14 }}>{sheet.data.interests.map((t, i) => <span key={i} className="sns-tag">{t}</span>)}</div>
        <div className="a-label" style={{ marginBottom: 8 }}>대화 소재로 활용하기 좋은 것</div>
        {sheet.data.topics.map((t, i) => <div key={i} style={{ fontSize: 12.5, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 11, padding: "8px 11px", marginBottom: 6 }}>{t}</div>)}
        <button className="primary-btn ready" style={{ marginTop: 8 }} onClick={() => onConfirmSns(sheet.personId, sheet.platform, sheet.data)}>{person.name} 기억에 추가하기</button>
        <button className="secondary-btn" onClick={onClose}>닫기</button>
      </>
    );
  }

  return (
    <div className={"sheet-backdrop" + (open ? " open" : "")} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">{content}</div>
    </div>
  );
}

/* =========================================================
   Full-screen overlays
   ========================================================= */
function Overlay({ overlay, state, onClose, onNavPerson, onSubscribe, onDeleteMemory, onEditMemory }) {
  if (overlay.type === "report") {
    const p = state.people[overlay.personId];
    const r = p && p.deepReport;
    return (
      <div className="overlay-page active">
        <div className="overlay-header"><div className="back-btn pressable" onClick={onClose}>‹</div><div className="overlay-ttl">{p ? p.name : ""} 심층 리포트</div></div>
        <div className="overlay-body">
          {!r ? <div className="empty-state"><div className="t2">아직 생성된 리포트가 없어.</div></div> : (
            <>
              <div className="unlocked-badge">✓ 구매 완료 · 평생 소장</div>
              <div className="report-section"><div className="rs-label">관찰된 성향</div><div className="rs-body">{r.traits}</div></div>
              <div className="report-section"><div className="rs-label">반복되는 패턴</div><ul>{(r.patterns || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div className="report-section"><div className="rs-label">긍정 신호</div><ul>{(r.positive || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div className="report-section"><div className="rs-label">주의 신호</div><ul>{(r.caution || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div className="report-section">
                <div className="rs-label">이렇게 대해보세요</div>
                <div className="dd-grid">
                  <div className="dd-col do"><div className="ddt">DO</div><ul>{(r.doList || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  <div className="dd-col dont"><div className="ddt">DON'T</div><ul>{(r.dontList || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                </div>
              </div>
              <div className="report-section">
                <div className="rs-label">앞으로 30일 행동 계획</div>
                {(r.plan || []).map((x, i) => <div className="plan-step" key={i}><div className="pn">{i + 1}</div><div className="pt">{x}</div></div>)}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  if (overlay.type === "subscription") {
    const features = ["심층 리포트 월 3회 무료 발급", "월간 관계 종합 리포트", "고급 행동 계획(Action Plan)", "Before / After 관계 변화 비교", "사람과 사람 사이 관계망(Relationship Graph)", "매달 지급되는 Insight 크레딧"];
    return (
      <div className="overlay-page active">
        <div className="overlay-header"><div className="back-btn pressable" onClick={onClose}>‹</div><div className="overlay-ttl">사이로그 플러스</div></div>
        <div className="overlay-body">
          <div className="sub-hero"><div className="sub-badge"><FoxIcon size={26} /></div><div className="sub-title">사이로그 플러스</div><p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>더 깊이, 더 자주 알고 싶을 때</p></div>
          <div className="sub-price"><span className="sub-amt">₩9,900</span><span className="sub-per"> / 월</span></div>
          <div className="card">{features.map(f => <div className="sub-feature" key={f}><span>✓</span><span>{f}</span></div>)}</div>
          {state.subscription ? <div className="unlocked-badge" style={{ marginTop: 16 }}>✓ 이미 구독 중이야</div> :
            <button className="sub-cta pressable" onClick={onSubscribe}>구독하기</button>}
          <p style={{ textAlign: "center", fontSize: 10.5, color: "var(--ink-faint)", marginTop: 10 }}>언제든 해지할 수 있어요.</p>
        </div>
      </div>
    );
  }
  if (overlay.type === "memory") {
    const people = Object.values(state.people);
    return (
      <div className="overlay-page active">
        <div className="overlay-header"><div className="back-btn pressable" onClick={onClose}>‹</div><div className="overlay-ttl">AI Memory 관리</div></div>
        <div className="overlay-body">
          {people.length === 0 && <div className="empty-state"><div className="t2">아직 기록된 사람이 없어.</div></div>}
          {people.map(p => (
            <div className="mem-block" key={p.id}>
              <div className="mem-head"><div className="avatar" style={{ background: p.color }}>{p.initial}</div><div className="mem-head-nm">{p.name}</div></div>
              <div className="card">
                {p.memory.length === 0 && <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>기록된 정보가 없어.</div>}
                {p.memory.map(m => <MemRow key={m.id} p={p} m={m} onDelete={() => onDeleteMemory(p.id, m.id)} onEdit={(v) => onEditMemory(p.id, m.id, v)} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (overlay.type === "graph") {
    const people = Object.values(state.people);
    const n = people.length;
    const cx = 150, cy = 190, radius = 120;
    const nodes = people.map((p, i) => ({
      id: p.id, label: p.name, color: p.color,
      x: n === 1 ? cx : cx + radius * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
      y: n === 1 ? cy : cy + radius * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
    }));
    const edgeEntries = Object.entries(state.edges);
    return (
      <div className="overlay-page active">
        <div className="overlay-header"><div className="back-btn pressable" onClick={onClose}>‹</div><div className="overlay-ttl">관계망</div></div>
        <div className="overlay-body">
          {people.length === 0 ? <div className="empty-state"><div className="t2">사람이 2명 이상 등록되면 관계망을 볼 수 있어.</div></div> : (
            <>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <svg width="300" height="380" viewBox="0 0 300 380">
                  {edgeEntries.map(([key, count]) => {
                    const [a, b] = key.split("|");
                    const na = nodes.find(n2 => n2.id === a), nb = nodes.find(n2 => n2.id === b);
                    if (!na || !nb) return null;
                    return <line key={key} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#C1863C" strokeWidth="2" strokeDasharray="5,5" />;
                  })}
                  {nodes.map(nd => (
                    <g key={nd.id} style={{ cursor: "pointer" }} onClick={() => onNavPerson(nd.id)}>
                      <circle cx={nd.x} cy={nd.y} r="24" fill={nd.color} />
                      <text x={nd.x} y={nd.y + 4} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="700">{nd.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
              <p className="graph-legend">점선은 여러 대화에서 함께 언급된 사람들이에요.<br />사람을 눌러 자세히 볼 수 있어.</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function MemRow({ p, m, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(m.val);
  return (
    <div className="memory-item">
      <div className="m-label">{m.label}</div>
      <div className="m-val">
        {editing ? (
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onBlur={() => { onEdit(val); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") { onEdit(val); setEditing(false); } }} />
        ) : m.val}
      </div>
      <div className="m-actions">
        <button onClick={() => setEditing(true)}>✎</button>
        <button onClick={onDelete}>🗑</button>
      </div>
    </div>
  );
}

import { C } from "./theme";

const ROUTES_DATA = [
  { d:"M-30,520 C150,400 350,260 550,180 S800,60 1030,10", c:"pri", lo:0.12, to:0.20, td:"26s", dd:"4s", wp:[[180,410],[420,240],[700,110],[900,45]] },
  { d:"M-30,80 C180,180 380,340 580,400 S830,500 1030,560", c:"acc", lo:0.10, to:0.16, td:"32s", dd:"5s", wp:[[160,170],[400,320],[650,420],[880,520]], rev:true },
  { d:"M1030,300 C820,240 620,320 420,300 S180,340 -30,370", c:"sec", lo:0.10, to:0.18, td:"24s", dd:"3.5s", wp:[[870,260],[640,310],[350,310],[120,355]] },
  { d:"M500,-30 C520,100 470,240 510,370 S480,490 530,630", c:"pri", lo:0.08, to:0.14, td:"22s", dd:"4.5s", wp:[[512,80],[480,260],[505,430]] },
  { d:"M-30,200 C80,150 200,90 340,50 S500,20 600,-20", c:"acc", lo:0.09, to:0.15, td:"18s", dd:"3s", wp:[[70,160],[220,85],[420,35]] },
  { d:"M1030,480 C900,440 780,500 650,520 S480,560 350,590", c:"sec", lo:0.07, to:0.13, td:"20s", dd:"4s", wp:[[920,450],[720,500],[530,540]] },
];

let _svgUid = 0;
function buildRoutesSvg({ trucks = true, opacityMul = 1, centerFade = true } = {}) {
  const uid = ++_svgUid;
  const col = k => k === "pri" ? C.pri : k === "acc" ? C.acc : C.sec;
  return `<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%"><defs><radialGradient id="rf${uid}" cx="50%" cy="48%" rx="30%" ry="28%"><stop offset="0%" stop-color="white" stop-opacity="${centerFade?0.15:0.5}"/><stop offset="70%" stop-color="white" stop-opacity="${centerFade?0.6:0.8}"/><stop offset="100%" stop-color="white" stop-opacity="1"/></radialGradient><mask id="rm${uid}"><rect width="1000" height="600" fill="url(#rf${uid})"/></mask></defs><g mask="url(#rm${uid})">${ROUTES_DATA.map(r=>{const cc=col(r.c);const lo=(r.lo*opacityMul).toFixed(3);const to=(r.to*opacityMul).toFixed(3);const wo=(r.lo*1.6*opacityMul).toFixed(3);return`<g><path d="${r.d}" stroke="${cc}" stroke-width="2" fill="none" stroke-dasharray="14,18" stroke-linecap="round" opacity="${lo}"><animate attributeName="stroke-dashoffset" from="0" to="${r.rev?64:-64}" dur="${r.dd}" repeatCount="indefinite"/></path>${r.wp.map(w=>`<g opacity="${wo}"><path d="M${w[0]},${w[1]-10} c-4,0 -7,3 -7,7 c0,4 7,11 7,11 s7,-7 7,-11 c0,-4 -3,-7 -7,-7Z" fill="${cc}"/><circle cx="${w[0]}" cy="${w[1]-5}" r="2.5" fill="${C.bg}" opacity="0.9"/></g>`).join("")}${trucks?`<g opacity="${to}"><animateMotion path="${r.d}" dur="${r.td}" repeatCount="indefinite" rotate="auto" keyPoints="${r.rev?"1;0":"0;1"}" keyTimes="0;1" calcMode="linear"/><rect x="-14" y="-7" width="18" height="14" rx="2" fill="${cc}"/><polygon points="4,-5 10,-5 14,-1 14,7 4,7" fill="${cc}"/><circle cx="-7" cy="8" r="3" fill="${cc}"/><circle cx="-7" cy="8" r="1.5" fill="${C.bg}"/><circle cx="10" cy="8" r="3" fill="${cc}"/><circle cx="10" cy="8" r="1.5" fill="${C.bg}"/><rect x="5" y="-4" width="5" height="5" rx="1" fill="${C.bg}" opacity="0.6"/></g>`:""}</g>`}).join("")}</g></svg>`;
}

export function RoutesBackground({ trucks, opacityMul, centerFade }) {
  return <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0}} dangerouslySetInnerHTML={{__html:buildRoutesSvg({trucks,opacityMul,centerFade})}} />;
}

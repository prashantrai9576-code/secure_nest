// dashboard.js
const BACKEND='http://localhost:5000';
const html=document.documentElement;

// ── Theme ──
html.setAttribute('data-theme',localStorage.getItem('sn_theme')||'dark');
function toggleTheme(){
  const t=html.getAttribute('data-theme')==='dark'?'light':'dark';
  html.setAttribute('data-theme',t);
  localStorage.setItem('sn_theme',t);
  const cb=document.getElementById('darkModeToggle');
  if(cb) cb.checked=(t==='light');
  if(actChart) initCharts();
}

// ── Auth Guard ──
const isDemoMode = (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey === 'YOUR_API_KEY');

auth.onAuthStateChanged(async user => {
  if(!user && !isDemoMode){window.location.href='auth.html';return;}
  
  let name = 'User';
  
  if (isDemoMode) {
    const storedUser = JSON.parse(localStorage.getItem('sn_current_user') || '{}');
    name = storedUser.name || 'Demo Admin';
  } else if (user) {
    name = user.displayName || user.email;
    // Try to fetch from database if name is missing in profile
    if (!user.displayName && typeof db !== 'undefined') {
      try {
        const snap = await db.ref('users/' + user.uid + '/name').once('value');
        if (snap.val()) name = snap.val();
      } catch(e) {}
    }
  }

  const el=document.getElementById('sidebarUserName');
  if(el) el.textContent=name;
  const av=document.getElementById('headerAvatar');
  const headerAv = document.getElementById('headerAvatar');
  if(headerAv) headerAv.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`;
  
  // Set avatar in sidebar too
  const sidebarAv = document.querySelector('.sidebar-avatar');
  if (sidebarAv) sidebarAv.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`;

  if (!isDemoMode) initFirebaseListeners();
});

function logout(){
  if (isDemoMode) {
    localStorage.removeItem('sn_current_user');
    window.location.href = 'auth.html';
  } else {
    auth.signOut().then(()=>window.location.href='auth.html');
  }
}

// ── Sidebar ──
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── Tab Navigation ──
const tabTitles={
  dashboard:'Dashboard Overview',locks:'Locks Control',
  logs:'Access Logs',camera:'Camera Records',
  alerts:'Security Alerts',family:'Family Members',settings:'Settings'
};
function switchTab(tab){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  const nav=document.getElementById('nav-'+tab);
  if(nav) nav.classList.add('active');
  document.getElementById('pageTitle').textContent=tabTitles[tab]||'';
  if(tab==='dashboard') initCharts();
  if(tab==='logs') renderLogs();
  if(tab==='camera') renderCamera();
  if(tab==='alerts') renderAlerts();
  if(tab==='family') renderFamily();
  closeSidebar();
}

// ── Clock ──
function updateClock(){
  const el=document.getElementById('liveClock');
  if(el) el.textContent=new Date().toLocaleTimeString('en-US',{hour12:false});
}
setInterval(updateClock,1000); updateClock();

// ── Weather ──
function fetchWeather(){
  fetch('https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true')
    .then(r=>r.json()).then(d=>{
      const t=document.getElementById('weatherTemp');
      const c=document.getElementById('weatherCity');
      if(t) t.textContent=d.current_weather.temperature+'°C';
      if(c) c.textContent='Delhi';
    }).catch(()=>{});
}
fetchWeather();

// ── Toast ──
function showToast(msg,type='info'){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  const icons={success:'fa-circle-check',danger:'fa-circle-exclamation',warning:'fa-triangle-exclamation',info:'fa-circle-info'};
  const colors={success:'var(--color-success)',danger:'var(--color-danger)',warning:'var(--color-warning)',info:'var(--color-brand-500)'};
  t.className=`toast toast-${type}`;
  t.innerHTML=`<i class="fa-solid ${icons[type]||icons.info}" style="color:${colors[type]}"></i>${msg}`;
  c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},3500);
}

// ── Lock States ──
const lockStates={1:false,2:true,3:true};

function toggleLock(id,name){
  const btn=document.getElementById('lockBtn'+id);
  btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
  btn.disabled=true;
  // Send command to backend
  fetch(`${BACKEND}/api/lock/toggle`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({lock_id:id,name,command:lockStates[id]?'unlock':'lock'})
  }).catch(()=>{});
  // Optimistic UI update after 800ms
  setTimeout(()=>{
    lockStates[id]=!lockStates[id];
    updateLockUI(id);
    btn.disabled=false;
    showToast(`${name} ${lockStates[id]?'locked':'unlocked'} successfully`,lockStates[id]?'info':'success');
    // Write to Firebase
    if(!isDemoMode && typeof db!=='undefined'){
      db.ref('locks/'+name.toLowerCase().replace(/ /g,'_')).set({
        locked:lockStates[id],updated_at:Date.now()
      });
    }
  },800);
}

function updateLockUI(id){
  const locked=lockStates[id];
  const btn=document.getElementById('lockBtn'+id);
  const bar=document.getElementById('lockBar'+id);
  const badge=document.getElementById('lockBadge'+id);
  const icon=document.getElementById('lockIcon'+id);
  const ring=document.getElementById('lockRing'+id);
  if(!btn) return;
  if(locked){
    btn.className='lock-btn unlock-btn';
    btn.innerHTML='<i class="fa-solid fa-unlock"></i> Unlock Door';
    bar.style.background='var(--color-danger)';
    badge.className='badge badge-danger';
    badge.innerHTML='<i class="fa-solid fa-lock"></i> Locked';
    icon.className='fa-solid fa-lock lock-main-icon';
    icon.style.color='var(--color-danger)';
    ring.className='lock-ring locked';
  }else{
    btn.className='lock-btn lock-btn-dark';
    btn.innerHTML='<i class="fa-solid fa-lock"></i> Lock Door';
    bar.style.background='var(--color-success)';
    badge.className='badge badge-success';
    badge.innerHTML='<i class="fa-solid fa-lock-open"></i> Unlocked';
    icon.className='fa-solid fa-unlock lock-main-icon';
    icon.style.color='var(--color-success)';
    ring.className='lock-ring unlocked';
  }
}

// ── Charts ──
let actChart=null,methodChart=null,attemptChart=null;
function initCharts(){
  const isDark=html.getAttribute('data-theme')==='dark';
  const tc=isDark?'#94a3b8':'#475569';
  const gc=isDark?'#1e293b':'#e2e8f0';

  // Activity Chart
  const ctx=document.getElementById('activityChart');
  if(ctx){
    if(actChart) actChart.destroy();
    const isLast=document.getElementById('chartWeekSelect')?.value==='last';
    actChart=new Chart(ctx,{
      type:'line',
      data:{
        labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets:[
          {label:'Authorized',data:isLast?[8,14,11,20,18,25,22]:[12,19,15,25,22,30,28],
           borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',borderWidth:2.5,tension:0.4,fill:true,pointBackgroundColor:'#3b82f6',pointRadius:4},
          {label:'Unauthorized',data:isLast?[1,0,2,1,2,0,1]:[2,0,1,0,3,1,0],
           borderColor:'#ef4444',backgroundColor:'transparent',borderWidth:2,borderDash:[5,5],tension:0.4,pointBackgroundColor:'#ef4444',pointRadius:4}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:tc,font:{family:'Inter',size:12}}}},
        scales:{y:{grid:{color:gc},ticks:{color:tc}},x:{grid:{display:false},ticks:{color:tc}}}}
    });
  }

  // Method Doughnut
  const ctx2=document.getElementById('methodChart');
  if(ctx2){
    if(methodChart) methodChart.destroy();
    methodChart=new Chart(ctx2,{
      type:'doughnut',
      data:{labels:['Face','Fingerprint','Web App'],
        datasets:[{data:[45,35,20],backgroundColor:['#3b82f6','#6366f1','#06b6d4'],borderWidth:0,hoverOffset:4}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'72%',
        plugins:{legend:{position:'bottom',labels:{color:tc,font:{size:11},padding:12}}}}
    });
  }

  // Attempt bar
  const ctx3=document.getElementById('attemptChart');
  if(ctx3){
    if(attemptChart) attemptChart.destroy();
    attemptChart=new Chart(ctx3,{
      type:'bar',
      data:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets:[{label:'Attempts',data:[2,0,1,0,3,1,0],backgroundColor:'rgba(239,68,68,0.7)',borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:tc}}},
        scales:{y:{grid:{color:gc},ticks:{color:tc,stepSize:1}},x:{grid:{display:false},ticks:{color:tc}}}}
    });
  }
}
function updateChart(){initCharts();}

// ── Activity Feed ──
const FEED=[
  {icon:'fa-face-viewfinder',color:'blue',title:'Front Door Unlocked',sub:'Face Auth – John Doe',time:'2 mins ago'},
  {icon:'fa-user-secret',color:'red',title:'Unknown Face Detected',sub:'Back Door Camera',time:'15 mins ago'},
  {icon:'fa-mobile-screen',color:'purple',title:'Garage Door Locked',sub:'App Command – Admin',time:'1 hour ago'},
  {icon:'fa-fingerprint',color:'cyan',title:'Front Door Unlocked',sub:'Fingerprint – Sarah',time:'3 hours ago'},
];
function renderFeed(){
  const feed=document.getElementById('activityFeed');
  if(!feed) return;
  feed.innerHTML=FEED.map(f=>`
    <div class="activity-item">
      <div class="activity-icon icon-box-${f.color}" style="background:rgba(var(--c-${f.color}),0.12)">
        <i class="fa-solid ${f.icon}"></i>
      </div>
      <div>
        <div class="activity-text" style="${f.color==='red'?'color:var(--color-danger)':''}">${f.title}</div>
        <div class="activity-sub">${f.sub}</div>
        <div class="activity-time">${f.time}</div>
      </div>
    </div>`).join('');
}

// ── Logs ──
const LOGS_DATA=[
  {user:'John Doe',bg:'3b82f6',date:'Apr 19, 2026','time':'08:30 AM',door:'Front Door',method:'Face',status:'Granted'},
  {user:'Unknown Person',bg:'ef4444',date:'Apr 19, 2026','time':'02:15 AM',door:'Back Door',method:'Face',status:'Denied'},
  {user:'Admin User',bg:'3b82f6',date:'Apr 18, 2026','time':'10:45 PM',door:'Garage Door',method:'Web App',status:'Granted'},
  {user:'Sarah Smith',bg:'a78bfa',date:'Apr 18, 2026','time':'06:10 PM',door:'Front Door',method:'Fingerprint',status:'Granted'},
  {user:'Raj Kumar',bg:'34d399',date:'Apr 18, 2026','time':'09:00 AM',door:'Front Door',method:'Face',status:'Granted'},
  {user:'Unknown Person',bg:'ef4444',date:'Apr 17, 2026','time':'03:44 AM',door:'Back Door',method:'Fingerprint',status:'Denied'},
];
let filteredLogs=LOGS_DATA;
function filterLogs(){
  const q=document.getElementById('logsSearch').value.toLowerCase();
  const d=document.getElementById('doorFilter').value;
  const s=document.getElementById('statusFilter').value;
  filteredLogs=LOGS_DATA.filter(l=>{
    return (!q||l.user.toLowerCase().includes(q)||l.door.toLowerCase().includes(q))
      &&(!d||l.door===d)&&(!s||l.status===s);
  });
  renderLogs();
}
const methodIcons={Face:'fa-face-viewfinder',Fingerprint:'fa-fingerprint','Web App':'fa-mobile-screen'};
const methodColors={Face:'#3b82f6',Fingerprint:'#6366f1','Web App':'#a78bfa'};
function renderLogs(){
  const tbody=document.getElementById('logsBody');
  if(!tbody) return;
  tbody.innerHTML=filteredLogs.map(l=>`<tr>
    <td><div class="user-cell">
      ${l.user==='Unknown Person'
        ?'<div class="user-unknown"><i class="fa-solid fa-user-secret"></i></div>'
        :`<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(l.user)}&background=${l.bg}&color=fff" class="user-avatar">`}
      <span style="font-weight:600;${l.status==='Denied'?'color:var(--color-danger)':''}">${l.user}</span>
    </div></td>
    <td style="color:var(--text-muted)">${l.date} · ${l.time}</td>
    <td>${l.door}</td>
    <td><span style="display:flex;align-items:center;gap:.35rem"><i class="fa-solid ${methodIcons[l.method]}" style="color:${methodColors[l.method]}"></i>${l.method}</span></td>
    <td><span class="badge ${l.status==='Granted'?'badge-success':'badge-danger'}">${l.status}</span></td>
  </tr>`).join('');
}
function loadMoreLogs(){ showToast('All logs loaded','info'); }
function exportLogsCSV(){
  const rows=[['User','Date','Time','Door','Method','Status'],...filteredLogs.map(l=>[l.user,l.date,l.time,l.door,l.method,l.status])];
  const csv=rows.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv,'+encodeURIComponent(csv);
  a.download='access_logs.csv'; a.click();
}
function exportLogsPDF(){
  showToast('Generating PDF... Please wait','info');
  window.open(`${BACKEND}/api/logs/export/pdf`, '_blank');
}

// ── Camera ──
const CAMERA_DATA=[
  {src:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&fit=crop',cam:'Front Door Cam',status:'Known',label:'John Doe (98%)',time:'Today 08:30 AM',alert:false},
  {src:'',cam:'Back Door Cam',status:'Unknown',label:'Alert Triggered',time:'Today 02:15 AM',alert:true},
  {src:'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&fit=crop',cam:'Front Door Cam',status:'Known',label:'Sarah Smith',time:'Yesterday 06:10 PM',alert:false},
  {src:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&fit=crop',cam:'Garage Cam',status:'Known',label:'Raj Kumar',time:'Yesterday 09:00 AM',alert:false},
];
function renderCamera(){
  const grid=document.getElementById('cameraGrid');
  if(!grid) return;
  grid.innerHTML=CAMERA_DATA.map((c,i)=>`
    <div class="cam-card ${c.alert?'alert-ring':''}" onclick="openImgModal(${i})">
      <div class="cam-img-wrap">
        ${c.src?`<img src="${c.src}" alt="${c.cam}" loading="lazy">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--text-muted)"><i class="fa-solid fa-user-secret"></i></div>`}
        <div class="cam-overlay-badge">${c.alert?'<i class="fa-solid fa-video" style="color:#ef4444"></i> Alert':'<i class="fa-solid fa-video" style="color:#ef4444"></i> Rec'}</div>
      </div>
      <div class="cam-info">
        <div class="cam-info-row">
          <span class="cam-name">${c.cam}</span>
          <span class="badge ${c.status==='Known'?'badge-success':'badge-danger'}">${c.status}</span>
        </div>
        <div class="cam-time"><i class="fa-regular fa-clock"></i> ${c.time}</div>
        <div class="cam-id ${c.alert?'text-danger':''}">${c.label}</div>
      </div>
    </div>`).join('');
}
function openImgModal(i){
  const c=CAMERA_DATA[i];
  const m=document.getElementById('imgModal');
  const img=document.getElementById('imgModalSrc');
  img.src=c.src||'https://via.placeholder.com/600x400/1e293b/ef4444?text=UNKNOWN';
  document.getElementById('imgModalLabel').textContent=c.cam+' – '+c.status;
  document.getElementById('imgModalSub').textContent=c.time+' · '+c.label;
  m.classList.add('open');
}
function closeImgModal(e){ if(e.target===e.currentTarget) document.getElementById('imgModal').classList.remove('open'); }

// ── Alerts ──
const ALERTS_DATA=[
  {level:'high',icon:'fa-triangle-exclamation',title:'Multiple Failed Attempts',time:'10 mins ago',desc:'5 failed fingerprint scans at Front Door. Scanner temporarily locked.',actions:true},
  {level:'high',icon:'fa-user-secret',title:'Unknown Person Detected',time:'15 mins ago',desc:'Unrecognized face detected at Back Door camera. Image captured.',actions:true},
  {level:'warn',icon:'fa-battery-quarter',title:'Low Battery – Back Door',time:'2 hours ago',desc:'Back Door lock battery at 15%. Please replace soon.',actions:false},
  {level:'warn',icon:'fa-shield-xmark',title:'Tamper Attempt Detected',time:'3 hours ago',desc:'Physical tamper detected on Garage Door lock casing.',actions:false},
  {level:'safe',icon:'fa-wifi',title:'System Update Applied',time:'Yesterday',desc:'Firmware v2.4.1 installed on ESP32 Central Hub. IoT stable.',actions:false},
];
const levelMap={high:{cls:'alert-high',tc:'var(--color-danger)',ic:'icon-box-red'},warn:{cls:'alert-warn',tc:'var(--color-warning)',ic:'icon-box-yellow'},safe:{cls:'alert-safe',tc:'var(--color-success)',ic:'icon-box-green'}};
function renderAlerts(){
  const list=document.getElementById('alertsList');
  if(!list) return;
  list.innerHTML=ALERTS_DATA.map((a,i)=>{
    const m=levelMap[a.level];
    return `<div class="alert-card ${m.cls}" id="alert-${i}">
      <div class="alert-icon-wrap ${m.ic}"><i class="fa-solid ${a.icon}"></i></div>
      <div class="alert-body">
        <div class="alert-row">
          <h4 class="alert-title" style="color:${m.tc}">${a.title}</h4>
          <span class="alert-time" style="color:${m.tc}">${a.time}</span>
        </div>
        <p class="alert-desc">${a.desc}</p>
        ${a.actions?`<div class="alert-actions">
          <button class="btn btn-sm" style="background:${m.tc};color:#fff" onclick="switchTab('camera')">View Camera</button>
          <button class="btn btn-secondary btn-sm" onclick="dismissAlert(${i})">Dismiss</button>
        </div>`:''}
      </div>
    </div>`;
  }).join('');
}
function dismissAlert(i){
  const el=document.getElementById('alert-'+i);
  if(el){el.style.opacity='0';el.style.transform='translateX(30px)';setTimeout(()=>el.remove(),300);}
}
function markAllRead(){
  document.querySelectorAll('.alert-card').forEach(el=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);});
  document.getElementById('alertBadge').textContent='0';
  showToast('All alerts dismissed','success');
}

// ── Family Members ──
const MEMBERS=[
  {name:'Admin User',role:'Owner',bg:'3b82f6',face:true,fp:true,app:true,perms:{front:true,back:true,garage:true}},
  {name:'Sarah Smith',role:'Family Member',bg:'a78bfa',face:true,fp:true,app:false,perms:{front:true,back:false,garage:true}},
  {name:'Raj Kumar',role:'Guest',bg:'34d399',face:true,fp:false,app:false,perms:{front:true,back:false,garage:false}},
];
function renderFamily(){
  const grid=document.getElementById('familyGrid');
  if(!grid) return;
  grid.innerHTML=MEMBERS.map((m,i)=>`
    <div class="member-card">
      <button class="member-menu-btn" onclick="editMember(${i})"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      <div class="member-avatar-wrap">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=${m.bg}&color=fff" class="member-avatar">
        <div class="member-online-dot"></div>
      </div>
      <div class="member-name">${m.name}</div>
      <div class="member-role">${m.role}</div>
      <div class="member-methods">
        <div class="method-dot ${m.face?'method-active':'method-inactive'}" title="Face Recognition"><i class="fa-solid fa-face-smile"></i></div>
        <div class="method-dot ${m.fp?'method-active':'method-inactive'}" title="Fingerprint"><i class="fa-solid fa-fingerprint"></i></div>
        <div class="method-dot ${m.app?'method-active':'method-inactive'}" title="App Access"><i class="fa-solid fa-mobile-screen"></i></div>
      </div>
      <div class="member-perms">
        ${Object.entries(m.perms).map(([door,ok])=>`
          <div class="member-perm-row">
            <span>${door.charAt(0).toUpperCase()+door.slice(1)} Door</span>
            <i class="fa-solid ${ok?'fa-check perm-granted':'fa-xmark perm-denied'}"></i>
          </div>`).join('')}
      </div>
    </div>`).join('');
}
function openAddMember(){
  document.getElementById('memberModalTitle').textContent='Add Family Member';
  document.getElementById('memberIndex').value='-1';
  document.getElementById('memberForm').reset();
  document.getElementById('memberModal').classList.add('open');
}

function editMember(i){
  const m=MEMBERS[i];
  document.getElementById('memberModalTitle').textContent='Edit Member';
  document.getElementById('memberIndex').value=i;
  document.getElementById('mName').value=m.name;
  document.getElementById('mRole').value=m.role;
  document.getElementById('pFront').checked=m.perms.front;
  document.getElementById('pBack').checked=m.perms.back;
  document.getElementById('pGarage').checked=m.perms.garage;
  document.getElementById('memberModal').classList.add('open');
}

function handleMemberSubmit(e){
  e.preventDefault();
  const idx=parseInt(document.getElementById('memberIndex').value);
  const name=document.getElementById('mName').value;
  const role=document.getElementById('mRole').value;
  const perms={
    front:document.getElementById('pFront').checked,
    back:document.getElementById('pBack').checked,
    garage:document.getElementById('pGarage').checked
  };

  if(idx===-1){
    MEMBERS.push({name,role,bg:'6366f1',face:true,fp:true,app:false,perms});
    showToast('Member added successfully','success');
  }else{
    MEMBERS[idx]={...MEMBERS[idx],name,role,perms};
    showToast('Member updated successfully','success');
  }
  renderFamily();
  document.getElementById('memberModal').classList.remove('open');
}

// ── Settings ──
function saveSetting(key,val){
  localStorage.setItem('sn_'+key,val);
  showToast('Setting saved','success');
}
function changePassword(){
  const c=document.getElementById('currentPwd').value;
  const n=document.getElementById('newPwd').value;
  if(!c||!n){showToast('Fill both fields','warning');return;}
  if(n.length<8){showToast('Min 8 characters','warning');return;}
  const user=auth.currentUser;
  if(user){
    const cred=firebase.auth.EmailAuthProvider.credential(user.email,c);
    user.reauthenticateWithCredential(cred)
      .then(()=>user.updatePassword(n))
      .then(()=>{showToast('Password updated!','success');document.getElementById('currentPwd').value='';document.getElementById('newPwd').value='';})
      .catch(e=>showToast(e.message,'danger'));
  }else{showToast('Please log in again','warning');}
}
function rebootSystem(){
  fetch(`${BACKEND}/api/system/reboot`,{method:'POST'}).catch(()=>{});
  showToast('Reboot command sent to ESP32/RPi','info');
}
function logoutAllDevices(){
  if (isDemoMode) {
    localStorage.removeItem('sn_current_user');
    window.location.href = 'auth.html';
  } else {
    auth.signOut().then(()=>window.location.href='auth.html');
  }
}

// ── Firebase Realtime Listeners ──
function initFirebaseListeners(){
  if(typeof db==='undefined') return;
  // Listen to lock states
  db.ref('locks').on('value',snap=>{
    const data=snap.val()||{};
    const nameToId={front_door:1,back_door:2,garage_door:3};
    Object.entries(nameToId).forEach(([key,id])=>{
      if(data[key]!==undefined){
        lockStates[id]=data[key].locked;
        updateLockUI(id);
      }
    });
  });
  // Listen to alerts count
  db.ref('alerts').on('value',snap=>{
    const count=snap.numChildren();
    const badge=document.getElementById('alertBadge');
    if(badge) badge.textContent=count>0?count:'0';
  });
}

// ── AI Chat ──
function toggleChat(){
  document.getElementById('aiChatBox').classList.toggle('open');
}
const aiReplies=[
  'All 3 locks are connected and online.',
  'Front Door was last unlocked by John Doe at 08:30 AM today.',
  'There are 3 active security alerts. Check the Alerts tab.',
  'You can export access logs from the Logs tab as CSV or PDF.',
  'The system uses Firebase Realtime Database for instant sync.',
  'AI face recognition runs on the Raspberry Pi using DeepFace.',
  'Battery level for Back Door lock is 65%.',
  'To add a family member, go to Family Members tab.',
];
function sendAiMsg(){
  const input=document.getElementById('aiInput');
  const msg=input.value.trim();
  if(!msg) return;
  const box=document.getElementById('aiMessages');
  box.innerHTML+=`<div class="ai-msg user">${msg}</div>`;
  input.value='';
  setTimeout(()=>{
    const reply=aiReplies[Math.floor(Math.random()*aiReplies.length)];
    box.innerHTML+=`<div class="ai-msg bot">${reply}</div>`;
    box.scrollTop=box.scrollHeight;
  },700);
  box.scrollTop=box.scrollHeight;
}

// ── Voice Command ──
function startVoice(){
  if(!('webkitSpeechRecognition' in window)){showToast('Voice not supported in this browser','warning');return;}
  const r=new webkitSpeechRecognition();
  r.lang='en-US';r.interimResults=false;r.maxAlternatives=1;
  r.onresult=e=>{
    const cmd=e.results[0][0].transcript.toLowerCase();
    if(cmd.includes('unlock front')){toggleLock(1,'Front Door');}
    else if(cmd.includes('lock front')){lockStates[1]=true;updateLockUI(1);}
    else if(cmd.includes('unlock back')){toggleLock(2,'Back Door');}
    else if(cmd.includes('unlock garage')){toggleLock(3,'Garage Door');}
    else if(cmd.includes('dashboard')){switchTab('dashboard');}
    else if(cmd.includes('alerts')){switchTab('alerts');}
    else if(cmd.includes('logs')){switchTab('logs');}
    else{showToast(`Command: "${cmd}" – not recognized`,'warning');}
  };
  r.onerror=()=>showToast('Voice error','danger');
  r.start();
  showToast('Listening… say a command','info');
}

// ── Theme & Theme Colors ──
const root = document.documentElement;
const primaryColor = localStorage.getItem('sn_primary_color') || '#3b82f6';
const sidebarColor = localStorage.getItem('sn_sidebar_color') || (html.getAttribute('data-theme')==='dark'?'#0f172a':'#ffffff');

function toggleThemeDrawer(){
  document.getElementById('themeDrawer').classList.toggle('open');
  document.getElementById('drawerBackdrop').classList.toggle('show');
}

function applyThemeColors(){
  const p = localStorage.getItem('sn_primary_color') || '#3b82f6';
  const s = localStorage.getItem('sn_sidebar_color') || (html.getAttribute('data-theme')==='dark'?'#0f172a':'#ffffff');
  
  root.style.setProperty('--color-primary', p);
  root.style.setProperty('--bg-sidebar', s);
  
  // Update all color inputs
  document.querySelectorAll('.color-input').forEach(el => {
    if(el.onchange.toString().includes('updatePrimaryColor')) el.value = p;
    if(el.onchange.toString().includes('updateSidebarColor')) el.value = s;
  });
}



function updatePrimaryColor(val){
  localStorage.setItem('sn_primary_color', val);
  root.style.setProperty('--color-primary', val);
  showToast('Primary color updated','success');
}

function updateSidebarColor(val){
  localStorage.setItem('sn_sidebar_color', val);
  root.style.setProperty('--bg-sidebar', val);
  showToast('Sidebar color updated','success');
}

function resetTheme(){
  localStorage.removeItem('sn_primary_color');
  localStorage.removeItem('sn_sidebar_color');
  applyThemeColors();
  showToast('Theme reset to default','info');
}

// Update toggleTheme to handle sidebar color reset if needed
function toggleTheme(){
  const t=html.getAttribute('data-theme')==='dark'?'light':'dark';
  html.setAttribute('data-theme',t);
  localStorage.setItem('sn_theme',t);
  
  const cb=document.getElementById('darkModeToggle');
  if(cb) cb.checked=(t==='light');
  
  const hToggle = document.getElementById('darkToggleHeader');
  if(hToggle) hToggle.checked = (t === 'light');
  
  // Update sidebar color if it's default
  if(!localStorage.getItem('sn_sidebar_color')){
    root.style.setProperty('--bg-sidebar', t==='dark'?'#0f172a':'#ffffff');
  }
  
  if(actChart) initCharts();
}

// ── Init ──
document.addEventListener('DOMContentLoaded',()=>{
  applyThemeColors();
  renderFeed();
  renderLogs();
  renderCamera();
  renderAlerts();
  renderFamily();
  // init dark mode toggle checkbox
  const cb=document.getElementById('darkModeToggle');
  if(cb) cb.checked=(html.getAttribute('data-theme')==='light');
  // init charts after slight delay
  setTimeout(initCharts,200);
});

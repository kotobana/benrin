import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BookOpen,Calendar,Check,CheckCheck,ChevronLeft,ChevronRight,Download,Home,Leaf,NotebookPen,Plus,Search,Settings,Sun,Trash2,WalletCards,X} from 'lucide-react';
import {type State,type Routine,type Note,type Book,type Transaction,type BudgetSettings,DEFAULT_CATEGORIES,emptyState,today,period,due,validState,getCalendarGrid} from './model';
import './style.css';

const uid=()=>crypto.randomUUID();
const labels={daily:'日課',weekly:'週課',monthly:'月課',unknown:'未設定',unread:'未読',reading:'読書中',read:'読了'};

function App(){
 const [data,setData]=useState<State>(emptyState()),[page,setPage]=useState('home'),[query,setQuery]=useState(''),[ready,setReady]=useState(false),[save,setSave]=useState('読み込み中'),[error,setError]=useState(''),[date,setDate]=useState(today()),[modal,setModal]=useState<'routine'|'note'|'book'|'tx'|'budget'|null>(null),[editing,setEditing]=useState(''),[filter,setFilter]=useState('all'),[category,setCategory]=useState('all'),[dark,setDark]=useState(localStorage.getItem('benrin-theme')==='dark');
 const [calMonth,setCalMonth]=useState(today().slice(0,7)),[selectedDate,setSelectedDate]=useState(today());

 const revision=useRef(0),latest=useRef(data),persisted=useRef(data),saving=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [routine,setRoutine]=useState<Routine>({id:'',title:'',frequency:'daily',weekdays:[],day:0,paused:false,created:today()});
 const [note,setNote]=useState<Note>({id:'',title:'',body:'',tags:'',bookId:'',updated:''});
 const [book,setBook]=useState<Book>({id:'',title:'',author:'',status:'unread',finished:'',rating:0,review:''});
 const [tx,setTx]=useState<Transaction>({id:'',date:today(),type:'expense',amount:0,category:'食費',memo:''});
 const [budgetInput,setBudgetInput]=useState(0);

 useEffect(()=>{
   fetch('/api/state')
     .then(async r=>{if(!r.ok)throw Error('データを読み込めません。ログイン・サーバー設定を確認してください。');return r.json();})
     .then(v=>{
       if(!validState(v.state))throw Error('保存データの形式を確認できません。');
       const state = { ...v.state, transactions: v.state.transactions || [] };
       revision.current=v.revision;
       latest.current=persisted.current=state;
       setData(state);
       setReady(true);
       setSave('保存済み');
     })
     .catch(e=>setError(e.message));
   const i=setInterval(()=>setDate(today()),30000);
   return()=>clearInterval(i);
 },[]);

 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('benrin-theme',dark?'dark':'light');},[dark]);
 useEffect(()=>{const f=(e:BeforeUnloadEvent)=>{if(latest.current!==persisted.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',f);return()=>window.removeEventListener('beforeunload',f);},[]);

 async function flush(){
   if(saving.current||latest.current===persisted.current)return;
   saving.current=true;setSave('保存中…');const snapshot=latest.current;
   try{
     const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,revision:revision.current})});
     if(r.status===409)throw Error('別の画面で更新されています。設定から未保存データを書き出してから、再読み込みしてください。');
     if(!r.ok)throw Error('保存できませんでした。接続を確認して「再試行」を押してください。');
     revision.current=(await r.json()).revision;persisted.current=snapshot;setError('');setSave('保存済み');
   }catch(e){setError((e as Error).message);setSave('未保存');saving.current=false;return;}
   saving.current=false;if(latest.current!==persisted.current)void flush();
 }

 function update(fn:(s:State)=>State){
   const next=fn(latest.current);latest.current=next;setData(next);setSave('未保存');
   if(timer.current)clearTimeout(timer.current);
   timer.current=setTimeout(()=>void flush(),550);
 }

 function navigate(p:string){setPage(p);setQuery('');setFilter('all');setCategory('all');}

 function open(kind:'routine'|'note'|'book'|'tx'|'budget',id='',presetDate=''){
   setEditing(id);
   if(kind==='routine')setRoutine(data.routines.find(x=>x.id===id)||{id:uid(),title:'',frequency:'daily',weekdays:[],day:0,paused:false,created:date});
   if(kind==='note')setNote(data.notes.find(x=>x.id===id)||{id:uid(),title:'',body:'',tags:'',bookId:'',updated:new Date().toISOString()});
   if(kind==='book')setBook(data.books.find(x=>x.id===id)||{id:uid(),title:'',author:'',status:'unread',finished:'',rating:0,review:''});
   if(kind==='tx'){
     const found=data.transactions?.find(x=>x.id===id);
     setTx(found||{id:uid(),date:presetDate||date,type:'expense',amount:0,category:'食費',memo:''});
   }
   if(kind==='budget')setBudgetInput(data.budget?.monthlyTarget||0);
   setModal(kind);
 }

 function storeItem(kind:'routine'|'note'|'book'|'tx',value:Routine|Note|Book|Transaction){
   update(s=>{
     const txs=s.transactions||[];
     if(kind==='routine')return {...s,routines:[...s.routines.filter(x=>x.id!==value.id),value as Routine]};
     if(kind==='note')return {...s,notes:[...s.notes.filter(x=>x.id!==value.id),{...value,updated:new Date().toISOString()} as Note]};
     if(kind==='book')return {...s,books:[...s.books.filter(x=>x.id!==value.id),value as Book]};
     return {...s,transactions:[...txs.filter(x=>x.id!==value.id),value as Transaction]};
   });
 }

 function remove(kind:'routine'|'note'|'book'|'tx',id:string){
   if(!confirm('削除しますか？ この操作は取り消せません。'))return;
   update(s=>{
     const txs=s.transactions||[];
     if(kind==='routine')return {...s,routines:s.routines.filter(x=>x.id!==id)};
     if(kind==='note')return {...s,notes:s.notes.filter(x=>x.id!==id)};
     if(kind==='book')return {...s,books:s.books.filter(x=>x.id!==id),notes:s.notes.map(n=>n.bookId===id?{...n,bookId:''}:n)};
     return {...s,transactions:txs.filter(x=>x.id!==id)};
   });
   setModal(null);
 }

 function mark(r:Routine,status:'done'|'skipped'){
   const p=period(r,date);
   update(s=>{
     const old=s.entries.find(e=>e.routineId===r.id&&e.period===p);
     const isUnchecking=old?.status===status;
     const entries=[...s.entries.filter(e=>!(e.routineId===r.id&&e.period===p)),...(isUnchecking?[]:[{routineId:r.id,period:p,status,at:new Date().toISOString(),title:r.title}])];
     let txs=s.transactions||[];
     if(r.financial&&r.financial.autoRecord&&r.financial.amount>0){
       if(status==='done'&&!isUnchecking){
         if(!txs.some(t=>t.routineId===r.id&&t.date===date)){
           txs=[...txs,{id:uid(),date,type:r.financial.type,amount:r.financial.amount,category:r.financial.category,memo:`${r.title}（日課連動）`,routineId:r.id}];
         }
       }else if(isUnchecking){
         txs=txs.filter(t=>!(t.routineId===r.id&&t.date===date));
       }
     }
     return {...s,entries,transactions:txs};
   });
 }

 const active=data.routines.filter(r=>due(r,date));
 const done=active.filter(r=>data.entries.some(e=>e.routineId===r.id&&e.period===period(r,date)&&e.status==='done')).length;
 const txList=data.transactions||[];

 // Monthly finances calculation
 const currentMonthTxs=txList.filter(t=>t.date.startsWith(calMonth));
 const monthExpense=currentMonthTxs.filter(t=>t.type==='expense').reduce((sum,t)=>sum+t.amount,0);
 const monthIncome=currentMonthTxs.filter(t=>t.type==='income').reduce((sum,t)=>sum+t.amount,0);

 // Category breakdown
 const catTotals:Record<string,number>={};
 for(const t of currentMonthTxs.filter(x=>x.type==='expense')){catTotals[t.category]=(catTotals[t.category]||0)+t.amount;}
 const sortedCats=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);

 // NMD (No Money Days)
 const daysInMonth=new Date(Number(calMonth.slice(0,4)),Number(calMonth.slice(5,7)),0).getDate();
 const daysWithExpense=new Set(currentMonthTxs.filter(t=>t.type==='expense'&&t.amount>0).map(t=>t.date));
 const isPastOrCurrentMonth=calMonth<=today().slice(0,7);
 const countDays=calMonth===today().slice(0,7)?Number(today().slice(8,10)):daysInMonth;
 const nmdCount=Math.max(0,countDays-daysWithExpense.size);

 // Calendar calculations
 const calGrid=getCalendarGrid(calMonth,date);

 function shiftMonth(diff:number){
   const [y,m]=calMonth.split('-').map(Number);
   const nextDate=new Date(Date.UTC(y,m-1+diff,1));
   setCalMonth(nextDate.toISOString().slice(0,7));
 }

 const matches=(...v:string[])=>v.join(' ').toLowerCase().includes(query.toLowerCase());
 const nav=[['home','ホーム',Home],['calendar','カレンダー',Calendar],['routines','日課・週課・月課',CheckCheck],['finances','家計簿',WalletCards],['notes','メモ',NotebookPen],['books','本棚',BookOpen],['settings','設定',Settings]] as const;

 function routineRow(r:Routine){
   const entry=data.entries.find(e=>e.routineId===r.id&&e.period===period(r,date));
   return <div className={'routine-row '+(entry?'completed':'')} key={r.id}>
     <button className={'check '+(entry?.status==='done'?'checked':'')} disabled={r.paused||!due(r,date)} aria-label={r.title+'を'+(entry?.status==='done'?'未完了に戻す':'完了にする')} onClick={()=>mark(r,'done')}>{entry?.status==='done'&&<Check size={17}/>}</button>
     <button className="row-title" onClick={()=>open('routine',r.id)}>{r.title}<small>{r.paused?'一時停止中':entry?.status==='skipped'?'今回はスキップ':r.frequency==='monthly'?(r.day?`毎月${r.day}日から`:'月内に1回'):r.frequency==='daily'&&r.weekdays.length?r.weekdays.map(d=>'日月火水木金土'[d]).join('・')+'曜日':labels[r.frequency]}{r.financial&&` · ¥${r.financial.amount.toLocaleString()}`}</small></button>
     <span className={'badge '+r.frequency}>{labels[r.frequency]}</span>
     <button className="quiet skip" disabled={r.paused||!due(r,date)} onClick={()=>mark(r,'skipped')}>{entry?.status==='skipped'?'戻す':'スキップ'}</button>
   </div>;
 }

 function noteCard(n:Note){return <button className="note-card" key={n.id} onClick={()=>open('note',n.id)}><small>{new Date(n.updated).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}</small><h3>{n.title||'無題のメモ'}</h3><p>{n.body||'まだ本文がありません'}</p><div className="tags">{n.tags.split(',').filter(Boolean).map((t,i)=><span key={i}>#{t.trim()}</span>)}</div></button>;}
 function bookCard(b:Book){return <button className="book-card" key={b.id} onClick={()=>open('book',b.id)}><div className={'cover '+b.status}><BookOpen size={25}/><strong>{b.title}</strong><small>{b.author||'著者未登録'}</small></div><div><span className="badge">{b.category ? b.category+' · ' : ''}{labels[b.status]}</span><h3>{b.title}</h3><p>{b.author||'著者未登録'}</p>{b.totalVolumes&&<p>{b.readVolumes||'—'} / {b.totalVolumes}巻 {b.sourceStatus==='完結'?'・完結':''}</p>}{b.rating>0&&<span className="stars">{'★'.repeat(b.rating)}</span>}</div></button>;}
 function blank(text:string,kind:'routine'|'note'|'book'|'tx'){return <div className="empty"><Leaf size={28}/><h3>{text}</h3><p>ひとつずつ、あなたのペースで。</p><button className="primary" onClick={()=>open(kind as never)}><Plus size={16}/>追加する</button></div>;}

 function backup(){const blob=new Blob([JSON.stringify({format:'benrin-v1',exported:new Date().toISOString(),state:latest.current},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`benrin-${date}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

 return <div className="app">
  <aside>
    <a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('home')}}><span><Leaf size={24}/></span>benrin<span className="brand-dot">.</span></a>
    <p className="tagline">暮らしの、小さな道具箱。</p>
    <div className="nav-label">MY WORKSPACE</div>
    <nav>{nav.map(([key,label,Icon])=><button className={page===key?'selected':''} key={key} onClick={()=>navigate(key)}><Icon size={19}/>{label}{page===key&&<span className="nav-dot"/>}</button>)}</nav>
    <div className="sidebar-foot"><span className="status-dot"/>{save}<small>自分だけのスペース</small></div>
  </aside>

  <main>
    <header>
      <span>マイワークスペース <ChevronRight size={13}/> {nav.find(n=>n[0]===page)?.[1]}</span>
      <button className="icon-button" aria-label="表示テーマを切り替え" onClick={()=>setDark(!dark)}><Sun size={20}/></button>
    </header>

    {error&&<div role="alert" className="error">{error}<button onClick={()=>void flush()}>再試行</button><button onClick={backup}>未保存データを書き出す</button></div>}

    {!ready?<div className="empty">{error?'読み込みを完了できませんでした。':'道具箱を開いています…'}</div>:
    <div className="content">
      {page==='home'&&<>
        <div className="greeting">
          <div>
            <p className="eyebrow">{new Date(date+'T00:00:00+09:00').toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'long'})}</p>
            <h1>今日も、ひとつずつ。</h1>
            <p>やること、支出のめやす、心に残った言葉。</p>
          </div>
          <div className="greeting-art"><Leaf size={64} strokeWidth={1}/><span>MAKE ROOM<br/>FOR YOUR EVERYDAY.</span></div>
        </div>

        <div className="stats" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <button onClick={()=>navigate('routines')}>
            <span className="stat-icon green"><CheckCheck/></span>
            <div><small>今日・今週・今月の達成</small><strong>{done}<em> / {active.length}</em></strong></div>
            <div className="progress"><i style={{width:`${active.length?done/active.length*100:0}%`}}/></div>
          </button>
          <button onClick={()=>navigate('finances')}>
            <span className="stat-icon orange"><WalletCards/></span>
            <div><small>今月の支出合計</small><strong>¥{monthExpense.toLocaleString()}</strong></div>
          </button>
          <button onClick={()=>navigate('notes')}>
            <span className="stat-icon blue"><NotebookPen/></span>
            <div><small>書きとめたメモ</small><strong>{data.notes.length}<em> 件</em></strong></div>
          </button>
          <button onClick={()=>navigate('books')}>
            <span className="stat-icon green"><BookOpen/></span>
            <div><small>今年読み終えた本</small><strong>{data.books.filter(b=>b.status==='read'&&b.finished.startsWith(date.slice(0,4))).length}<em> 冊</em></strong></div>
          </button>
        </div>

        <section>
          <div className="section-head"><h2>今日のチェックリスト <span>{active.length-done}</span></h2><button className="quiet" onClick={()=>navigate('routines')}>すべて見る <ChevronRight size={15}/></button></div>
          <div className="panel">{active.length?active.map(routineRow):blank('今日は、ここから始めよう','routine')}</div>
        </section>

        <div className="home-columns">
          <section>
            <div className="section-head"><h2>最近のメモ</h2><button className="quiet" onClick={()=>open('note')}><Plus size={16}/>追加</button></div>
            <div className="note-grid">{data.notes.length?[...data.notes].sort((a,b)=>b.updated.localeCompare(a.updated)).slice(0,2).map(noteCard):blank('思いつきを、忘れないうちに','note')}</div>
          </section>
          <section>
            <div className="section-head"><h2>読書中の本</h2><button className="quiet" onClick={()=>navigate('books')}>本棚へ <ChevronRight size={15}/></button></div>
            {data.books.some(b=>b.status==='reading')?data.books.filter(b=>b.status==='reading').slice(0,2).map(bookCard):blank('次の一冊を、本棚に','book')}
          </section>
        </div>
      </>}

      {page==='calendar'&&<div className="calendar-view">
        <div className="cal-header">
          <div className="cal-nav">
            <button className="icon-button" onClick={()=>shiftMonth(-1)} aria-label="前月"><ChevronLeft size={20}/></button>
            <span className="cal-title">{Number(calMonth.slice(0,4))}年 {Number(calMonth.slice(5,7))}月</span>
            <button className="icon-button" onClick={()=>shiftMonth(1)} aria-label="翌月"><ChevronRight size={20}/></button>
            <button className="pill-btn" onClick={()=>setCalMonth(today().slice(0,7))}>今月</button>
          </div>
          <div style={{fontSize:'12px',color:'var(--muted)'}}>
            今月の支出: <strong style={{color:'var(--ink)',fontSize:'14px'}}>¥{monthExpense.toLocaleString()}</strong> ｜ ノーマネーデー: <strong style={{color:'var(--green)'}}>{nmdCount}日</strong>
          </div>
        </div>

        <div className="cal-grid">
          {['月','火','水','木','金','土','日'].map(d=><div className="cal-day-head" key={d}>{d}</div>)}
          {calGrid.map(d=>{
            const dayTxs=txList.filter(t=>t.date===d.date&&t.type==='expense');
            const dayTotal=dayTxs.reduce((sum,t)=>sum+t.amount,0);
            const dayEntries=data.entries.filter(e=>e.at.startsWith(d.date)&&e.status==='done');
            const isNmd=d.date<=date&&d.isCurrentMonth&&dayTotal===0;
            return <div className={`cal-cell ${!d.isCurrentMonth?'other-month':''} ${d.isToday?'today':''} ${d.date===selectedDate?'selected':''}`} key={d.date} onClick={()=>setSelectedDate(d.date)}>
              <span className="cal-num">{d.dayNumber}</span>
              <div className="cal-dots">
                {dayEntries.slice(0,3).map((_,i)=><span className="cal-dot" key={i}/>)}
              </div>
              {dayTotal>0?<span className="cal-spent">¥{dayTotal.toLocaleString()}</span>:isNmd?<span className="cal-nmd">NMD</span>:null}
            </div>;
          })}
        </div>

        <div className="day-drawer">
          <h3>
            <span>{new Date(selectedDate+'T00:00:00+09:00').toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'long'})} の記録</span>
            <button className="primary" onClick={()=>open('tx','',selectedDate)}><Plus size={15}/>この日の出費を追加</button>
          </h3>
          <div className="day-sections">
            <div>
              <h4>完了した習慣・日課</h4>
              {data.entries.filter(e=>e.at.startsWith(selectedDate)&&e.status==='done').length===0?
                <p style={{fontSize:'12px',color:'var(--muted)'}}>この日の完了記録はありません。</p>:
                data.entries.filter(e=>e.at.startsWith(selectedDate)&&e.status==='done').map((e,i)=><div key={i} style={{padding:'8px 0',fontSize:'12px',borderBottom:'1px solid var(--line)'}}>✓ {e.title}</div>)
              }
            </div>
            <div>
              <h4>この日の収支</h4>
              {txList.filter(t=>t.date===selectedDate).length===0?
                <p style={{fontSize:'12px',color:'var(--muted)'}}>出費はありません（ノーマネーデー 🎉）。</p>:
                txList.filter(t=>t.date===selectedDate).map(t=><div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontSize:'12px',borderBottom:'1px solid var(--line)'}}>
                  <span><span className="tx-cat">{t.category}</span> {t.memo||t.category}</span>
                  <strong className={'tx-amt '+t.type}>{t.type==='expense'?'-':'+'}¥{t.amount.toLocaleString()}</strong>
                </div>)
              }
            </div>
          </div>
        </div>
      </div>}

      {page==='finances'&&<>
        <div className="page-heading">
          <div>
            <p className="eyebrow">HOUSEHOLD FINANCES</p>
            <h1>家計簿</h1>
            <p>日々の出費と暮らしのリズムを、シンプルに整える。</p>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <button className="secondary" onClick={()=>open('budget')}><Settings size={16}/>予算設定</button>
            <button className="primary" onClick={()=>open('tx')}><Plus size={17}/>出費を記録</button>
          </div>
        </div>

        <div className="finance-summary">
          <div className="finance-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3>{Number(calMonth.slice(5,7))}月の支出合計</h3>
              <div className="cal-nav">
                <button className="icon-button" onClick={()=>shiftMonth(-1)}><ChevronLeft size={16}/></button>
                <span style={{fontSize:'12px',fontWeight:600}}>{calMonth}</span>
                <button className="icon-button" onClick={()=>shiftMonth(1)}><ChevronRight size={16}/></button>
              </div>
            </div>
            <div className="finance-total expense">¥{monthExpense.toLocaleString()}</div>
            {monthIncome>0&&<div style={{fontSize:'12px',color:'var(--muted)'}}>（今月の収入: ¥{monthIncome.toLocaleString()}）</div>}
            {data.budget&&data.budget.monthlyTarget>0&&<>
              <div className={`budget-bar ${monthExpense>data.budget.monthlyTarget?'over':''}`}>
                <i style={{width:`${Math.min(100,(monthExpense/data.budget.monthlyTarget)*100)}%`}}/>
              </div>
              <div className="budget-meta">
                <span>目標: ¥{data.budget.monthlyTarget.toLocaleString()}</span>
                <span>{monthExpense<=data.budget.monthlyTarget?`残り ¥${(data.budget.monthlyTarget-monthExpense).toLocaleString()}`:`¥${(monthExpense-data.budget.monthlyTarget).toLocaleString()} 超過`}</span>
              </div>
            </>}
          </div>

          <div className="finance-card">
            <h3>カテゴリ別内訳</h3>
            <div className="category-bars">
              {sortedCats.length===0?<p style={{fontSize:'12px',color:'var(--muted)'}}>今月の支出データはありません。</p>:
                sortedCats.map(([cat,amt])=><div className="cat-row" key={cat}>
                  <span className="cat-name">{cat}</span>
                  <div className="cat-track"><i className="cat-fill" style={{width:`${monthExpense?amt/monthExpense*100:0}%`}}/></div>
                  <span className="cat-amt">¥{amt.toLocaleString()}</span>
                </div>)
              }
            </div>
          </div>
        </div>

        <div className="toolbar">
          <label className="search"><Search size={17}/><input aria-label="支出の検索" placeholder="メモやカテゴリで検索…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <select aria-label="種類の絞り込み" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">すべての収支</option>
            <option value="expense">支出のみ</option>
            <option value="income">収入のみ</option>
          </select>
        </div>

        <div className="tx-list">
          {currentMonthTxs.filter(t=>(filter==='all'||t.type===filter)&&matches(t.category,t.memo)).length===0?
            <p className="empty">該当する取引がありません。</p>:
            currentMonthTxs.filter(t=>(filter==='all'||t.type===filter)&&matches(t.category,t.memo)).sort((a,b)=>b.date.localeCompare(a.date)).map(t=><div className="tx-row" key={t.id}>
              <span className="tx-date">{t.date.slice(5)}</span>
              <span className="tx-cat">{t.category}</span>
              <span className="tx-memo">{t.memo||t.category}{t.routineId&&<small style={{color:'var(--muted)',marginLeft:'8px'}}>（日課）</small>}</span>
              <span className={'tx-amt '+t.type}>{t.type==='expense'?'-':'+'}¥{t.amount.toLocaleString()}</span>
              <button className="quiet" onClick={()=>open('tx',t.id)}>編集</button>
              <button className="quiet" onClick={()=>remove('tx',t.id)}><Trash2 size={14}/></button>
            </div>)
          }
        </div>
      </>}

      {page==='routines'&&<>
        <div className="page-heading">
          <div><p className="eyebrow">YOUR LITTLE TOOLBOX</p><h1>日課・週課・月課</h1><p>小さな積み重ねを、自分のリズムで。</p></div>
          <button className="primary" onClick={()=>open('routine')}><Plus size={17}/>追加する</button>
        </div>
        <div className="toolbar">
          <label className="search"><Search size={17}/><input aria-label="検索" placeholder="検索する…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <select aria-label="日課の絞り込み" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">すべて</option>
            <option value="daily">日課</option>
            <option value="weekly">週課</option>
            <option value="monthly">月課</option>
            <option value="history">実行履歴</option>
          </select>
        </div>
        {filter==='history'?<div className="panel">{[...data.entries].sort((a,b)=>b.at.localeCompare(a.at)).filter(e=>matches(e.title)).map((e,i)=><div className="history" key={i}><span>{e.status==='done'?'✓ 完了':'− スキップ'}</span><strong>{e.title}</strong><small>{e.period} · {new Date(e.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</small></div>)}{!data.entries.length&&<p className="empty">実行履歴はまだありません。</p>}</div>:
          <div className="panel">{data.routines.filter(r=>(filter==='all'||r.frequency===filter)&&matches(r.title)).map(routineRow)}{!data.routines.length?blank('続けたいことを、ひとつ','routine'):!data.routines.some(r=>(filter==='all'||r.frequency===filter)&&matches(r.title))&&<p className="empty">該当する日課がありません。</p>}</div>}
      </>}

      {page==='notes'&&<>
        <div className="page-heading">
          <div><p className="eyebrow">YOUR LITTLE TOOLBOX</p><h1>メモ</h1><p>考えやひらめきを、気軽に書きとめる。</p></div>
          <button className="primary" onClick={()=>open('note')}><Plus size={17}/>追加する</button>
        </div>
        <div className="toolbar"><label className="search"><Search size={17}/><input aria-label="検索" placeholder="検索する…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
        <div className="note-grid full">{[...data.notes].sort((a,b)=>b.updated.localeCompare(a.updated)).filter(n=>matches(n.title,n.body,n.tags)).map(noteCard)}{!data.notes.length?blank('最初のメモを書いてみよう','note'):!data.notes.some(n=>matches(n.title,n.body,n.tags))&&<p>該当するメモがありません。</p>}</div>
      </>}

      {page==='books'&&<>
        <div className="page-heading">
          <div><p className="eyebrow">YOUR LITTLE TOOLBOX</p><h1>本棚</h1><p>読んだ時間と、心に残った言葉を。</p></div>
          <button className="primary" onClick={()=>open('book')}><Plus size={17}/>追加する</button>
        </div>
        <div className="toolbar">
          <label className="search"><Search size={17}/><input aria-label="検索" placeholder="検索する…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <select aria-label="種類の絞り込み" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">すべての種類</option><option value="漫画">漫画</option><option value="小説">小説</option></select>
          <select aria-label="読書状態の絞り込み" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">すべての本</option>{(['unknown','unread','reading','read'] as const).map(v=><option key={v} value={v}>{labels[v]}</option>)}</select>
        </div>
        <div className="books-grid">{data.books.filter(b=>(filter==='all'||filter===b.status)&&(category==='all'||category===b.category)&&matches(b.title,b.author,b.review,b.genre||'')).map(bookCard)}{!data.books.length?blank('あなたの本棚をつくろう','book'):!data.books.some(b=>(filter==='all'||filter===b.status)&&(category==='all'||category===b.category)&&matches(b.title,b.author,b.review,b.genre||''))&&<p>該当する本がありません。</p>}</div>
      </>}

      {page==='settings'&&<div className="panel settings">
        <h2>データのバックアップ</h2>
        <p>日課の履歴、メモ、本棚、家計簿をまとめてJSONファイルに保存します。</p>
        <button className="primary" onClick={backup}><Download size={17}/>データを書き出す</button>
        <h2>バックアップから復元</h2>
        <p>現在のデータ全体を置き換えます。先に書き出しておくことをおすすめします。</p>
        <input aria-label="バックアップを選択" type="file" accept=".json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('ファイルが大きすぎます。');const v=JSON.parse(await file.text());if(v.format!=='benrin-v1'||!validState(v.state))throw Error('benrinのバックアップではありません。');if(confirm('現在のデータをバックアップの内容に置き換えますか？'))update(()=>v.state);}catch(err){setError((err as Error).message);}e.target.value='';}}/>
        <h2>表示</h2>
        <button className="secondary" onClick={()=>setDark(!dark)}>{dark?'ライトモードにする':'ダークモードにする'}</button>
      </div>}

      <footer>benrin <span>毎日を、少しだけ心地よく。</span><small>JAPAN STANDARD TIME</small></footer>
    </div>}
  </main>

  {/* Modals */}
  {modal&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&(modal==='note'||confirm('編集を閉じますか？ 未保存の入力は破棄されます。')))setModal(null)}}>
    <section className="modal" role="dialog" aria-modal="true" aria-label="編集モーダル">
      <div className="section-head">
        <h2>{modal==='routine'?'続けたいこと':modal==='note'?'メモを書く':modal==='book'?'本の記録':modal==='tx'?'収支の記録':'月の予算目標'}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={()=>{if(modal==='note'||confirm('編集を閉じますか？ 未保存の入力は破棄されます。'))setModal(null)}}><X/></button>
      </div>

      <form onSubmit={e=>{
        e.preventDefault();
        if(modal==='routine')storeItem('routine',routine);
        if(modal==='note')storeItem('note',note);
        if(modal==='book')storeItem('book',book);
        if(modal==='tx')storeItem('tx',tx);
        if(modal==='budget')update(s=>({...s,budget:{monthlyTarget:Number(budgetInput)||0}}));
        setModal(null);
      }}>
        {modal==='routine'&&<>
          <label>名前<input autoFocus required maxLength={200} value={routine.title} onChange={e=>setRoutine({...routine,title:e.target.value})} placeholder="例：20分、本を読む"/></label>
          <label>繰り返し<select value={routine.frequency} onChange={e=>setRoutine({...routine,frequency:e.target.value as Routine['frequency']})}>{(['daily','weekly','monthly'] as const).map(v=><option value={v} key={v}>{labels[v]}</option>)}</select></label>
          {routine.frequency==='daily'&&<fieldset><legend>曜日（未選択なら毎日）</legend><div className="weekdays">{Array.from('日月火水木金土').map((d,i)=><button className={routine.weekdays.includes(i)?'primary':'secondary'} type="button" key={d} aria-pressed={routine.weekdays.includes(i)} onClick={()=>setRoutine({...routine,weekdays:routine.weekdays.includes(i)?routine.weekdays.filter(x=>x!==i):[...routine.weekdays,i]})}>{d}</button>)}</div></fieldset>}
          {routine.frequency==='weekly'&&<p className="help">月曜から日曜までの間に1回。翌週には新しいチェック欄になります。</p>}
          {routine.frequency==='monthly'&&<label>取り組む日<select value={routine.day} onChange={e=>setRoutine({...routine,day:Number(e.target.value)})}><option value={0}>月内に1回（いつでも）</option>{Array.from({length:31},(_,i)=><option key={i} value={i+1}>{i===30?'月末（31日）':`${i+1}日から月末まで`}</option>)}</select><small>指定日がない月は、その月の最終日に表示します。</small></label>}
          <label className="checkbox-label"><input type="checkbox" checked={routine.paused} onChange={e=>setRoutine({...routine,paused:e.target.checked})}/>一時停止する</label>
          
          <fieldset style={{marginTop:'15px'}}>
            <legend>家計簿と連動（固定費・定期出費）</legend>
            <label className="checkbox-label"><input type="checkbox" checked={!!routine.financial} onChange={e=>setRoutine({...routine,financial:e.target.checked?{type:'expense',amount:0,category:'住まい・固定費',autoRecord:true}:undefined})}/>完了時に家計簿へ記帳する</label>
            {routine.financial&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'10px'}}>
              <label>金額（円）<input type="number" min="0" required value={routine.financial.amount||''} onChange={e=>setRoutine({...routine,financial:{...routine.financial!,amount:Number(e.target.value)}})}/></label>
              <label>カテゴリ<select value={routine.financial.category} onChange={e=>setRoutine({...routine,financial:{...routine.financial!,category:e.target.value}})}>{DEFAULT_CATEGORIES.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
            </div>}
          </fieldset>
        </>}

        {modal==='tx'&&<>
          <div className="form-type-toggle">
            <button type="button" className={`expense ${tx.type==='expense'?'active':''}`} onClick={()=>setTx({...tx,type:'expense'})}>支出</button>
            <button type="button" className={`income ${tx.type==='income'?'active':''}`} onClick={()=>setTx({...tx,type:'income'})}>収入</button>
          </div>
          <label>金額（円）<input type="number" autoFocus required min="0" style={{fontSize:'22px',fontWeight:700}} value={tx.amount||''} onChange={e=>setTx({...tx,amount:Number(e.target.value)})} placeholder="0"/></label>
          <label>日付<input type="date" required value={tx.date} onChange={e=>setTx({...tx,date:e.target.value})}/></label>
          <label>カテゴリ</label>
          <div className="pill-group">
            {DEFAULT_CATEGORIES.map(c=><button type="button" key={c} className={`pill-btn ${tx.category===c?'active':''}`} onClick={()=>setTx({...tx,category:c})}>{c}</button>)}
          </div>
          <label>メモ<input maxLength={1000} value={tx.memo} onChange={e=>setTx({...tx,memo:e.target.value})} placeholder="例: スーパーで食材、カフェ"/></label>
          {data.books.length>0&&<label>関連する本（任意）<select value={tx.bookId||''} onChange={e=>setTx({...tx,bookId:e.target.value})}><option value="">紐づけない</option>{data.books.map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select></label>}
        </>}

        {modal==='budget'&&<>
          <label>毎月の支出目標額（円）<input type="number" autoFocus min="0" style={{fontSize:'22px',fontWeight:700}} value={budgetInput||''} onChange={e=>setBudgetInput(Number(e.target.value))} placeholder="150000"/></label>
          <p className="help">0を設定すると目標を無効にします。家計簿画面で進捗バーが表示されます。</p>
        </>}

        {modal==='note'&&<>
          <p className="help">入力内容は自動保存されます · {save}</p>
          <label>タイトル<input autoFocus maxLength={200} value={note.title} onChange={e=>{const n={...note,title:e.target.value};setNote(n);storeItem('note',n)}} placeholder="無題のメモ"/></label>
          <label>本文<textarea rows={10} maxLength={100000} value={note.body} onChange={e=>{const n={...note,body:e.target.value};setNote(n);storeItem('note',n)}} placeholder="いま、思っていることを。"/></label>
          <label>タグ（カンマ区切り）<input maxLength={500} value={note.tags} onChange={e=>{const n={...note,tags:e.target.value};setNote(n);storeItem('note',n)}} placeholder="暮らし, アイデア"/></label>
          <label>関連する本<select value={note.bookId} onChange={e=>{const n={...note,bookId:e.target.value};setNote(n);storeItem('note',n)}}><option value="">紐づけない</option>{data.books.map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select></label>
        </>}

        {modal==='book'&&<>
          <label>書名<input autoFocus required maxLength={200} value={book.title} onChange={e=>setBook({...book,title:e.target.value})}/></label>
          <label>著者<input maxLength={200} value={book.author} onChange={e=>setBook({...book,author:e.target.value})}/></label>
          <div className="form-columns"><label>読書状態<select value={book.status} onChange={e=>setBook({...book,status:e.target.value as Book['status'],finished:e.target.value==='read'?(book.finished||date):''})}>{(['unknown','unread','reading','read'] as const).map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></label><label>評価<select value={book.rating} onChange={e=>setBook({...book,rating:Number(e.target.value)})}><option value={0}>未評価</option>{[1,2,3,4,5].map(v=><option key={v} value={v}>{'★'.repeat(v)}</option>)}</select></label></div>
          {book.status==='read'&&<label>読了日<input type="date" value={book.finished} onChange={e=>setBook({...book,finished:e.target.value})}/></label>}
          <div className="form-columns"><label>種類<select value={book.category||''} onChange={e=>setBook({...book,category:e.target.value})}><option value="">その他</option><option value="漫画">漫画</option><option value="小説">小説</option></select></label><label>ジャンル<input maxLength={200} value={book.genre||''} onChange={e=>setBook({...book,genre:e.target.value})}/></label></div>
          {book.category==='漫画'&&<div className="form-columns"><label>既読巻数<input type="number" min="0" value={book.readVolumes||''} onChange={e=>setBook({...book,readVolumes:e.target.value})}/></label><label>総巻数<input type="number" min="0" value={book.totalVolumes||''} onChange={e=>setBook({...book,totalVolumes:e.target.value})}/></label></div>}
          <label>媒体<input maxLength={200} value={book.medium||''} onChange={e=>setBook({...book,medium:e.target.value})}/></label>
          <label>概要<textarea rows={3} maxLength={100000} value={book.summary||''} onChange={e=>setBook({...book,summary:e.target.value})}/></label>
          <label>感想・心に残った言葉<textarea rows={5} maxLength={100000} value={book.review} onChange={e=>setBook({...book,review:e.target.value})}/></label>
        </>}

        <div className="modal-actions">
          {(editing||modal==='note'&&data.notes.some(n=>n.id===note.id))&&<button type="button" className="danger" onClick={()=>remove(modal as never,modal==='routine'?routine.id:modal==='note'?note.id:modal==='book'?book.id:tx.id)}><Trash2 size={16}/>削除</button>}
          <button className="primary" type="submit">{modal==='note'?'保存して閉じる':'保存する'}</button>
        </div>
      </form>
    </section>
  </div>}
 </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);

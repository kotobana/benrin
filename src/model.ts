export type Routine = {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  targetDate?: string;
  weekdays: number[];
  day: number;
  paused: boolean;
  created: string;
  financial?: { type: 'expense' | 'income'; amount: number; category: string; autoRecord: boolean };
};
export type Entry = {routineId:string; period:string; status:'done'|'skipped'; at:string; title:string};
export type Note = {id:string; title:string; body:string; tags:string; bookId:string; updated:string};
export type Book = {id:string; title:string; author:string; status:'unknown'|'unread'|'reading'|'read'; finished:string; rating:number; review:string; category?:string; genre?:string; medium?:string; summary?:string; readVolumes?:string; totalVolumes?:string; sourceStatus?:string; sourceUpdated?:string; sourceRows?:number[]; sourceSheet?:string; sourceId?:string};

export type Transaction = {
  id: string;
  date: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  memo: string;
  status?: 'confirmed' | 'planned';
  routineId?: string;
  bookId?: string;
};

export type BudgetSettings = {
  monthlyTarget: number;
};

export const DEFAULT_CATEGORIES = [
  '食費', '日用品', '住まい・固定費', '趣味・本', '交通・移動', '健康・医療', 'その他'
] as const;

export type State = {
  routines: Routine[];
  entries: Entry[];
  notes: Note[];
  books: Book[];
  transactions?: Transaction[];
  budget?: BudgetSettings;
};

export const emptyState = ():State => ({routines:[],entries:[],notes:[],books:[],transactions:[]});
export function today(now = new Date()):string {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function period(r:Routine,date:string):string {if(r.frequency==='once')return r.targetDate||date;if(r.frequency==='daily')return date;if(r.frequency==='monthly')return date.slice(0,7);const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function due(r:Routine,date:string):boolean {if(r.paused || date<r.created.slice(0,10))return false;if(r.frequency==='once')return r.targetDate===date;const d=new Date(date+'T00:00:00Z');if(r.frequency==='daily')return !r.weekdays.length||r.weekdays.includes(d.getUTCDay());if(r.frequency==='weekly')return true;const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();return r.day===0||d.getUTCDate()>=Math.min(r.day,last);}

export type CalendarDay = {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function getCalendarGrid(yearMonth: string, todayDate = today()): CalendarDay[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  const startWeekday = (firstDay.getUTCDay() + 6) % 7;
  const days: CalendarDay[] = [];

  for (let i = startWeekday; i > 0; i--) {
    const d = new Date(Date.UTC(y, m - 1, 1 - i));
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds, dayNumber: d.getUTCDate(), isCurrentMonth: false, isToday: ds === todayDate });
  }
  for (let i = 1; i <= lastDay.getUTCDate(); i++) {
    const d = new Date(Date.UTC(y, m - 1, i));
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds, dayNumber: i, isCurrentMonth: true, isToday: ds === todayDate });
  }
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(Date.UTC(y, m, i));
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds, dayNumber: i, isCurrentMonth: false, isToday: ds === todayDate });
  }
  return days;
}

export function validState(value:unknown):value is State {
 if(!value||typeof value!=='object')return false;const s=value as State;const str=(v:unknown,max=100000)=>typeof v==='string'&&v.length<=max;const id=(v:unknown)=>str(v,100)&&!!v;const arr=(v:unknown)=>Array.isArray(v)&&v.length<=10000;
 if(![s.routines,s.entries,s.notes,s.books].every(arr))return false;
 if(s.transactions!==undefined&&(!arr(s.transactions)||!s.transactions.every(t=>t&&id(t.id)&&str(t.date,10)&&['expense','income'].includes(t.type)&&Number.isInteger(t.amount)&&t.amount>=0&&str(t.category,100)&&str(t.memo,1000)&&(t.status===undefined||['confirmed','planned'].includes(t.status))&&(t.routineId===undefined||str(t.routineId,100))&&(t.bookId===undefined||str(t.bookId,100)))))return false;
 if(s.transactions&&new Set(s.transactions.map(t=>t.id)).size!==s.transactions.length)return false;
 if(s.budget!==undefined&&(!s.budget||typeof s.budget!=='object'||!Number.isInteger(s.budget.monthlyTarget)||s.budget.monthlyTarget<0))return false;
 if(!s.books.every(b=>b&&['category','genre','medium','summary','readVolumes','totalVolumes','sourceStatus','sourceUpdated','sourceSheet','sourceId'].every(k=>(b as unknown as Record<string,unknown>)[k]===undefined||str((b as unknown as Record<string,unknown>)[k]))&&(b.sourceRows===undefined||Array.isArray(b.sourceRows)&&b.sourceRows.every(x=>Number.isInteger(x)&&x>0))))return false;
 try{
  const routinesOk = s.routines.every(r=>id(r.id)&&str(r.title,200)&&['daily','weekly','monthly','once'].includes(r.frequency)&&(r.targetDate===undefined||str(r.targetDate,10))&&Array.isArray(r.weekdays)&&r.weekdays.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&Number.isInteger(r.day)&&r.day>=0&&r.day<=31&&typeof r.paused==='boolean'&&str(r.created,40)&&(r.financial===undefined||(typeof r.financial==='object'&&r.financial!==null&&['expense','income'].includes(r.financial.type)&&Number.isInteger(r.financial.amount)&&r.financial.amount>=0&&str(r.financial.category,100)&&typeof r.financial.autoRecord==='boolean')));
  const entriesOk = s.entries.every(e=>id(e.routineId)&&str(e.period,10)&&['done','skipped'].includes(e.status)&&str(e.at,40)&&str(e.title,200));
  const notesOk = s.notes.every(n=>id(n.id)&&str(n.title,200)&&str(n.body)&&str(n.tags,500)&&str(n.bookId,100)&&str(n.updated,40));
  const booksOk = s.books.every(b=>id(b.id)&&str(b.title,200)&&str(b.author,200)&&['unknown','unread','reading','read'].includes(b.status)&&str(b.finished,10)&&Number.isInteger(b.rating)&&b.rating>=0&&b.rating<=5&&str(b.review));
  const uniqueIds = [s.routines,s.notes,s.books].every(a=>new Set(a.map(x=>x.id)).size===a.length);
  return routinesOk && entriesOk && notesOk && booksOk && uniqueIds;
 }catch{return false;}
}


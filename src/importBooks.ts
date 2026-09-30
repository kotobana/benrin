import type {Book} from './model';
type Row=(string|null)[];
export function importBooks(sheets:Record<string,{values:Row[]}>,sourceId:string):Book[]{
 const books:Book[]=[];const exact=new Map<string,Book>();
 for(const [sheet,{values}] of Object.entries(sheets))values.forEach((row,index)=>{if(!row[0]?.trim())return;const key=sheet+JSON.stringify(row);if(exact.has(key)){exact.get(key)!.sourceRows!.push(index+(sheet==='漫画'?2:6));return;}
 const manga=sheet==='漫画',v=(i:number)=>row[i]||'';const sourceStatus=manga?v(4):'';const date=manga?'':v(3).replaceAll('/','-');
 const b:Book={id:`sheet-${sourceId}-${sheet}-${index}`,title:v(0),author:v(1),status:manga?(sourceStatus==='読了'?'read':sourceStatus==='読書中'?'reading':sourceStatus==='未読'?'unread':'unknown'):(date?'read':'unknown'),finished:date,rating:(v(5).match(/⭐/gu)||[]).length,review:v(manga?6:7),category:sheet,genre:manga?'':v(2),medium:manga?'':v(4),summary:manga?'':v(6),readVolumes:manga?v(2):'',totalVolumes:manga?v(3):'',sourceStatus,sourceUpdated:v(manga?7:8),sourceRows:[index+(manga?2:6)],sourceSheet:sheet,sourceId};books.push(b);exact.set(key,b);
 });return books;
}

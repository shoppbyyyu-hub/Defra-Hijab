import React,{useState} from 'react';
import {ChevronDown,ChevronUp} from 'lucide-react';

interface Field{label:string;value:React.ReactNode;}
interface Props{
  eyebrow:string;
  date?:string;
  title:string;
  subtitle?:React.ReactNode;
  thumbnail?:string;
  fields:Field[];
  status?:React.ReactNode;
  primaryAction?:React.ReactNode;
  details?:React.ReactNode;
  actions?:React.ReactNode;
}

export const AdminMobileListCard:React.FC<Props>=({eyebrow,date,title,subtitle,thumbnail,fields,status,primaryAction,details,actions})=>{
  const [expanded,setExpanded]=useState(false);
  return <article className="md:hidden bg-white border border-[#E8E2DC] rounded-[12px] p-3 space-y-2 text-left">
    <header className="flex items-start justify-between gap-2 text-[10px] leading-tight">
      <span className="font-semibold text-[#B88770] truncate">{eyebrow}</span>
      {date&&<span className="text-[#706861] shrink-0 text-right">{date}</span>}
    </header>
    <div className="flex items-center gap-2">
      {thumbnail&&<img src={thumbnail} alt="" className="w-12 h-12 rounded-[8px] object-cover shrink-0"/>}
      <div className="min-w-0 flex-1"><h3 className="text-[13px] font-semibold text-[#282420] truncate">{title}</h3>{subtitle&&<div className="text-[11px] text-[#706861] mt-0.5 line-clamp-2">{subtitle}</div>}</div>
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">{fields.slice(0,4).map((field,index)=><div key={`${field.label}-${index}`} className="min-w-0"><div className="text-[9px] text-[#706861]">{field.label}</div><div className="text-[11px] font-medium text-[#282420] break-words">{field.value}</div></div>)}</div>
    {(status||primaryAction)&&<div className="flex items-center justify-between gap-2 pt-1">{status&&<div className="min-w-0 text-[11px]">{status}</div>}<div className="ml-auto shrink-0">{primaryAction}</div></div>}
    {details&&<><button type="button" onClick={()=>setExpanded(value=>!value)} className="w-full min-h-11 flex items-center justify-center gap-1 text-[11px] font-medium text-[#87533F] bg-[#F3EBDF]/45 rounded-[8px]" aria-expanded={expanded}>{expanded?'Tutup detail':'Lihat detail'}{expanded?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}</button>{expanded&&<div className="pt-2 border-t border-[#E8E2DC] text-[11px] text-[#282420] space-y-1">{details}</div>}</>}
    {actions&&<footer className="pt-2 border-t border-[#E8E2DC] flex flex-wrap items-center gap-1.5">{actions}</footer>}
  </article>;
};

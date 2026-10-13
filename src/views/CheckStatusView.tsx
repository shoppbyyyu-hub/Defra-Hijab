import React, { useState } from 'react';
import { Search, AlertCircle, Package, Truck, Clock, CheckCircle2, Download } from 'lucide-react';
import { Header } from '../components/Header.tsx';
import { Footer } from '../components/Footer.tsx';

interface Props { onNavigate: (route:string)=>void }
interface PublicStatus { orderNumber:string; paymentStatus:string; fulfillmentStatus:string; trackingNumber?:string; createdAt:string; updatedAt:string }

export const CheckStatusView:React.FC<Props>=({onNavigate})=>{
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [orders,setOrders]=useState<PublicStatus[]>([]);
  const [selected,setSelected]=useState<PublicStatus|null>(null);
  const [invoiceEmail,setInvoiceEmail]=useState('');
  const [invoiceWhatsapp,setInvoiceWhatsapp]=useState('');
  const [invoiceLoading,setInvoiceLoading]=useState(false);

  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setOrders([]);setSelected(null);if(!query){setError('Masukkan nomor pesanan, email, atau WhatsApp persis seperti saat checkout.');return;}setLoading(true);try{const r=await fetch('/api/orders/check-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});const d=await r.json();if(!r.ok)throw new Error(d.error);const list=d.orders||[];setOrders(list);if(list.length===1)setSelected(list[0]);}catch(e){setError((e as Error).message||'Gagal memeriksa status pesanan.');}finally{setLoading(false);}};
  const status=(o:PublicStatus):[string,React.ComponentType<{className?:string}>]=>o.fulfillmentStatus==='DELIVERED'?['Pesanan diterima',CheckCircle2]:o.fulfillmentStatus==='SHIPPED'?['Dalam pengiriman',Truck]:o.paymentStatus==='VERIFIED'?['Pembayaran terverifikasi',Package]:['Menunggu verifikasi pembayaran',Clock];
  const downloadInvoice=async()=>{
    if(!selected)return;
    setError('');setInvoiceLoading(true);
    try{
      const accessResponse=await fetch('/api/orders/invoice-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:selected.orderNumber,email:invoiceEmail,whatsapp:invoiceWhatsapp})});
      const access=await accessResponse.json();
      if(!accessResponse.ok)throw new Error(access.error||'Verifikasi invoice gagal.');
      const pdfResponse=await fetch('/api/orders/invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:selected.orderNumber,accessToken:access.accessToken})});
      if(!pdfResponse.ok){const failure=await pdfResponse.json().catch(()=>({}));throw new Error(failure.error||'Invoice gagal dibuat.');}
      const url=URL.createObjectURL(await pdfResponse.blob());
      const link=document.createElement('a');link.href=url;link.download=`invoice-${selected.orderNumber}.pdf`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    }catch(e){setError((e as Error).message||'Invoice gagal diunduh.');}finally{setInvoiceLoading(false);}
  };

  return <div className="min-h-screen bg-white text-[#282420] flex flex-col"><Header onNavigate={onNavigate}/><main className="flex-1 w-full max-w-[680px] mx-auto px-4 sm:px-6 py-12 md:py-16"><section className="rounded-[20px] border border-white/70 bg-white/75 shadow-[0_18px_50px_rgba(40,36,32,.10)] backdrop-blur-xl p-6 md:p-9"><h1 className="text-2xl font-medium text-center">Cek Status Pesanan</h1><p className="text-sm text-[#706861] text-center mt-2 mb-7">Masukkan salah satu: nomor pesanan, email, atau WhatsApp. Nilai harus sama persis dengan data pesanan.</p><form onSubmit={submit} className="flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 min-w-0 h-11 px-3 border border-[#E8E2DC] rounded-[6px] text-sm outline-none focus:border-[#B88770]" placeholder="Nomor pesanan / email / WhatsApp"/><button disabled={loading} className="h-11 min-w-11 px-4 bg-[#282420] text-white rounded-[6px] text-sm disabled:opacity-50" aria-label="Cari pesanan"><Search className="w-4 h-4"/></button></form>{error&&<div className="mt-4 p-3 bg-red-50 text-red-800 text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}{orders.length>1&&!selected&&<div className="mt-6"><p className="text-xs text-[#706861] mb-2">Ditemukan beberapa pesanan. Pilih nomor pesanan:</p><div className="space-y-2">{orders.map(o=><button key={o.orderNumber} onClick={()=>setSelected(o)} className="w-full text-left p-3 border border-[#E8E2DC] rounded-[6px] text-sm hover:border-[#B88770]">{o.orderNumber}</button>)}</div></div>}{selected&&(()=>{const [label,Icon]=status(selected);return <div className="mt-7 border-t border-[#E8E2DC] pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-[#F3EBDF] flex items-center justify-center"><Icon className="w-5 h-5 text-[#B88770]"/></div><div><p className="font-medium">{label}</p><p className="text-xs text-[#706861]">{selected.orderNumber}</p></div></div>{selected.trackingNumber&&<p className="mt-4 text-xs">Nomor resi: <span className="font-medium">{selected.trackingNumber}</span></p>}<p className="mt-3 text-[11px] text-[#706861]">Diperbarui {new Date(selected.updatedAt).toLocaleString('id-ID')}</p>{selected.paymentStatus==='VERIFIED'&&<div className="mt-5 p-4 border border-[#E8E2DC] rounded-[8px]"><p className="text-xs font-medium">Unduh invoice</p><p className="text-[11px] text-[#706861] mt-1">Untuk melindungi alamat lengkap, verifikasi email dan WhatsApp pesanan.</p><div className="grid sm:grid-cols-2 gap-2 mt-3"><input type="email" value={invoiceEmail} onChange={e=>setInvoiceEmail(e.target.value)} placeholder="Email pesanan" className="h-11 px-3 border border-[#E8E2DC] rounded-[6px] text-sm outline-none focus:border-[#B88770]"/><input value={invoiceWhatsapp} onChange={e=>setInvoiceWhatsapp(e.target.value)} placeholder="WhatsApp pesanan" className="h-11 px-3 border border-[#E8E2DC] rounded-[6px] text-sm outline-none focus:border-[#B88770]"/></div><button type="button" disabled={invoiceLoading||!invoiceEmail||!invoiceWhatsapp} onClick={downloadInvoice} className="mt-3 h-11 px-4 inline-flex items-center gap-2 bg-[#282420] text-white rounded-[6px] text-xs disabled:opacity-50"><Download className="w-4 h-4"/>{invoiceLoading?'Menyiapkan invoice...':'Unduh Invoice PDF'}</button></div>}</div>;})()}</section></main><Footer onNavigate={onNavigate}/></div>;
};

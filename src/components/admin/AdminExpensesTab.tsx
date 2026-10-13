import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Filter,
  Search,
  Zap,
  TrendingDown,
  X,
  Edit2
} from 'lucide-react';
import type { OperationalExpense } from '../../types/index.ts';
import { formatRp } from './adminUtils.ts';
import { AdminMobileListCard } from './AdminMobileListCard.tsx';

interface ExpensesTabProps {
  dashboardData: any;
  token: string;
  onRefresh: (startDate?: string, endDate?: string) => void;
  onShowMessage: (msg: string) => void;
}

export const AdminExpensesTab: React.FC<ExpensesTabProps> = ({
  dashboardData,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OperationalExpense | null>(null);

  // Form State
  const [category, setCategory] = useState<OperationalExpense['category']>('ELECTRICITY');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(350000);
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const expenses: OperationalExpense[] = dashboardData?.expenses || [];
  const m = dashboardData?.metrics || {};

  // Group expenses by category for horizontal breakdown bars
  const categoryLabels: Record<string, string> = {
    ELECTRICITY: 'Listrik & Utilitas',
    RENT: 'Sewa Tempat & Toko',
    SALARY: 'Gaji Karyawan',
    MARKETING: 'Iklan & Marketing',
    PACKAGING: 'Material Kemasan Tambahan',
    MAINTENANCE: 'Pemeliharaan Toko',
    OTHER: 'Lainnya'
  };

  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Open add modal
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setCategory('ELECTRICITY');
    setDescription('');
    setAmount(350000);
    setPeriodMonth(new Date().toISOString().slice(0, 7));
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEdit = (exp: OperationalExpense) => {
    setEditingExpense(exp);
    setCategory(exp.category);
    setDescription(exp.description);
    setAmount(exp.amount);
    setPeriodMonth(exp.periodMonth);
    setExpenseDate(exp.expenseDate);
    setShowAddModal(true);
  };

  // Submit Add / Edit Expense
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert('Deskripsi dan nominal pengeluaran wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingExpense ? `/api/admin/expenses/${editingExpense.id}` : '/api/admin/expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category,
          description: description.trim(),
          amount: Number(amount),
          periodMonth,
          expenseDate
        })
      });

      if (res.ok) {
        onShowMessage(
          editingExpense
            ? `Pencatatan pengeluaran "${description}" berhasil diperbarui.`
            : `Pengeluaran operasional ${formatRp(amount)} berhasil dicatat.`
        );
        setShowAddModal(false);
        setEditingExpense(null);
        setDescription('');
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan pengeluaran.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Expense
  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus pencatatan beban operasional ini?')) return;
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onShowMessage('Pencatatan pengeluaran berhasil dihapus.');
        onRefresh();
      }
    } catch {
      alert('Gagal menghapus pengeluaran.');
    }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Biaya Operasional</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Catat biaya listrik, sewa, gaji, iklan, dan biaya lainnya untuk menghitung laba bersih.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="h-10 px-4 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#B88770]" />
          <span>Tambah Pengeluaran</span>
        </button>
      </div>

      {/* SUMMARY & HORIZONTAL CATEGORY BREAKDOWN BARS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* KPI Panel */}
        <div className="lg:col-span-5 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#87533F]">
              Total Beban Operasional
            </span>
            <p className="text-[32px] font-bold font-sans text-[#24221F] tabular-nums mt-1">
              {formatRp(totalExpenses)}
            </p>
            <p className="text-xs text-[#716B64] mt-1">
              {expenses.length} transaksi pengeluaran tercatat
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-[#E9E5DF] space-y-2 text-xs">
            <div className="flex justify-between text-[#716B64]">
              <span>Biaya Langsung Kemasan:</span>
              <span className="font-sans font-medium text-[#24221F]">{formatRp(m.directCosts || 0)}</span>
            </div>
            <div className="flex justify-between text-[#716B64]">
              <span>HPP Barang Terjual:</span>
              <span className="font-sans font-medium text-[#24221F]">{formatRp(m.totalHPP || 0)}</span>
            </div>
          </div>
        </div>

        {/* Horizontal Category Bar Breakdown */}
        <div className="lg:col-span-7 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E9E5DF]">
            <h2 className="text-[15px] font-medium text-[#24221F]">Komposisi Kategori Biaya</h2>
            <span className="text-xs text-[#716B64] font-medium">Beban Rutin</span>
          </div>

          {Object.keys(categoryTotals).length === 0 ? (
            <p className="text-xs text-[#716B64] py-8 text-center">Belum ada pengeluaran operasional dicatat.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {Object.entries(categoryTotals).map(([catKey, catAmt]) => {
                const ratio = totalExpenses > 0 ? Math.round((catAmt / totalExpenses) * 100) : 0;
                return (
                  <div key={catKey} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#24221F]">{categoryLabels[catKey] || catKey}</span>
                      <div className="flex items-center gap-2 font-sans tabular-nums">
                        <span className="font-semibold text-[#24221F]">{formatRp(catAmt)}</span>
                        <span className="text-[11px] text-[#716B64] w-8 text-right">({ratio}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-[#FAF9F7] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${ratio}%` }}
                        className="h-full bg-gradient-to-r from-[#D4A18A] to-[#87533F] rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <div className="space-y-3 md:hidden">
        {expenses.map((exp) => <AdminMobileListCard key={exp.id} eyebrow={exp.id} date={exp.expenseDate} title={exp.description} subtitle={categoryLabels[exp.category] || exp.category}
          fields={[{label:'Nominal',value:formatRp(exp.amount)},{label:'Periode',value:exp.periodMonth},{label:'Kategori',value:categoryLabels[exp.category] || exp.category},{label:'Tanggal',value:exp.expenseDate}]}
          status={<span className="font-semibold text-[#B33D39]">{formatRp(exp.amount)}</span>}
          primaryAction={<button type="button" onClick={() => handleOpenEdit(exp)} className="min-h-11 px-3 rounded-[8px] bg-[#282420] text-white inline-flex items-center gap-1.5"><Edit2 className="w-4 h-4"/>Edit</button>}
          details={<p><strong>Keperluan:</strong> {exp.description}</p>}
          actions={<button type="button" onClick={() => handleDelete(exp.id)} className="min-h-11 px-3 rounded-[8px] text-[#B33D39] inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4"/>Hapus</button>}/>) }
        {expenses.length === 0 && <p className="py-6 text-center text-xs text-[#716B64]">Belum ada pengeluaran operasional.</p>}
      </div>

      {/* EXPENSES TABLE */}
      <div className="hidden md:block bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="admin-responsive-table admin-expenses-table overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">Tanggal</th>
                <th className="p-4">Kategori Beban</th>
                <th className="p-4">Deskripsi / Keperluan</th>
                <th className="p-4">Periode Bulan</th>
                <th className="p-4 text-right">Nominal Pengeluaran</th>
                <th className="p-4 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF]">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-[#716B64]">
                    Belum ada pengeluaran operasional yang dicatat.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                    <td className="p-4 pl-5 font-sans text-[#716B64]">
                      {exp.expenseDate}
                    </td>
                    <td className="p-4 text-xs font-medium text-[#716B64]">
                      {categoryLabels[exp.category] || exp.category}
                    </td>
                    <td className="p-4 font-medium text-[#24221F]">
                      {exp.description}
                    </td>
                    <td className="p-4 text-[#716B64] font-sans">
                      {exp.periodMonth}
                    </td>
                    <td className="p-4 text-right font-sans font-bold text-[#B33D39] tabular-nums">
                      {formatRp(exp.amount)}
                    </td>
                    <td className="p-4 pr-5 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(exp)}
                          className="p-1.5 text-[#716B64] hover:text-[#24221F] hover:bg-[#FAF9F7] border border-[#E9E5DF] rounded-[6px] transition-colors"
                          title="Edit Catatan Pengeluaran"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#87533F]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 text-[#716B64] hover:text-[#B33D39] hover:bg-[#FAECEA] rounded-[6px] transition-colors"
                          title="Hapus pencatatan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TAMBAH BEBAN OPERASIONAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#24221F]">
                {editingExpense ? 'Edit Pengeluaran Operasional' : 'Catat Pengeluaran Operasional'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Kategori Biaya:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as OperationalExpense['category'])}
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
              >
                <option value="ELECTRICITY">Listrik &amp; Utilitas</option>
                <option value="RENT">Sewa Tempat &amp; Studio</option>
                <option value="SALARY">Gaji Karyawan</option>
                <option value="MARKETING">Iklan &amp; Marketing</option>
                <option value="PACKAGING">Kemasan Khusus Tambahan</option>
                <option value="MAINTENANCE">Pemeliharaan Toko</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Deskripsi Pengeluaran:</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Tagihan listrik PLN studio bulan ini..."
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#87533F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Nominal (Rp):</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-xs outline-none focus:border-[#87533F]"
                />
              </div>

              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Tanggal Transaksi:</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans text-xs outline-none focus:border-[#87533F]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : editingExpense ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

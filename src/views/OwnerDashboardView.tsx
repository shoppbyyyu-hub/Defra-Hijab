import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Tag,
  Image as ImageIcon,
  DollarSign,
  Settings,
  LogOut,
  CheckCircle2,
  Menu,
  X,
  ExternalLink,
  Bell,
  Search,
  RotateCcw,
  Receipt,
  Boxes,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import type {
  Order,
  Product,
  Category,
  Voucher,
  ReturnRequest,
  DefraSettings,
  HeroBanner,
  CampaignGalleryItem,
  CommunityReel
} from '../types/index.ts';

import { AdminMetricsTab } from '../components/admin/AdminMetricsTab.tsx';
import { AdminOrdersTab } from '../components/admin/AdminOrdersTab.tsx';
import { AdminProductsTab } from '../components/admin/AdminProductsTab.tsx';
import { AdminCategoriesTab } from '../components/admin/AdminCategoriesTab.tsx';
import { AdminStockTab } from '../components/admin/AdminStockTab.tsx';
import { AdminVouchersTab } from '../components/admin/AdminVouchersTab.tsx';
import { AdminBannersTab } from '../components/admin/AdminBannersTab.tsx';
import { AdminCommunityMedia } from '../components/admin/AdminCommunityMedia.tsx';
import { AdminReturnsTab } from '../components/admin/AdminReturnsTab.tsx';
import { AdminExpensesTab } from '../components/admin/AdminExpensesTab.tsx';
import { invalidateStorefrontData } from '../utils/storefrontInvalidation.ts';
import { AdminFinanceTab } from '../components/admin/AdminFinanceTab.tsx';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab.tsx';
import { AdminMobileBottomNav } from '../components/admin/AdminMobileBottomNav.tsx';

interface OwnerDashboardViewProps {
  token: string;
  onLogout: () => void;
  onNavigate: (route: string) => void;
}

export type AdminTab =
  | 'METRICS'
  | 'ORDERS'
  | 'REPORTS'
  | 'PRODUCTS'
  | 'CATEGORIES'
  | 'STOCK'
  | 'VOUCHERS'
  | 'BANNERS'
  | 'RETURNS'
  | 'EXPENSES'
  | 'SETTINGS';

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  token,
  onLogout,
  onNavigate
}) => {
  const tabMotionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('METRICS');
  const [orderInitialFilter, setOrderInitialFilter] = useState<string>('ALL');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const panel = tabMotionRef.current;
    if (!panel) return;
    panel.classList.remove('motion-tab-enter');
    void panel.offsetWidth;
    panel.classList.add('motion-tab-enter');
  }, [activeTab]);

  // Global Data State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [campaignGallery, setCampaignGallery] = useState<CampaignGalleryItem[]>([]);
  const [communityReels, setCommunityReels] = useState<CommunityReel[]>([]);
  const [settings, setSettings] = useState<DefraSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const loadedTabsRef = useRef(new Set<AdminTab>());

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3500);
  };

  const fetchDashboard = async (startDate?: string, endDate?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 403 || res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json();
      setDashboardData(data);
    } catch { }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
    } catch { }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch { }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch { }
  };

  const fetchVouchers = async () => {
    try {
      const res = await fetch('/api/admin/vouchers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.vouchers) setVouchers(data.vouchers);
    } catch { }
  };

  const fetchReturns = async () => {
    try {
      const res = await fetch('/api/admin/returns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.returns) setReturns(data.returns);
    } catch { }
  };

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/banners', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.banners) setBanners(data.banners);
      if (data.campaignGallery) setCampaignGallery(data.campaignGallery);
      if (data.communityReels) setCommunityReels(data.communityReels);
    } catch { }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch { }
  };

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/admin/expenses', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.expenses) setDashboardData((current: any) => ({ ...(current || {}), expenses: data.expenses }));
    } catch { }
  };

  useEffect(() => {
    loadedTabsRef.current.clear();
    setLoading(true);
    fetchDashboard().finally(() => {
      loadedTabsRef.current.add('METRICS');
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    if (activeTab === 'METRICS' || loadedTabsRef.current.has(activeTab)) return;
    loadedTabsRef.current.add(activeTab);
    const loads: Partial<Record<AdminTab, () => Promise<unknown>>> = {
      ORDERS: fetchOrders,
      PRODUCTS: () => Promise.all([fetchProducts(), fetchCategories()]),
      CATEGORIES: () => Promise.all([fetchCategories(), fetchProducts()]),
      STOCK: fetchProducts,
      VOUCHERS: () => Promise.all([fetchVouchers(), fetchCategories(), fetchProducts()]),
      BANNERS: fetchBanners,
      RETURNS: fetchReturns,
      EXPENSES: fetchExpenses,
      REPORTS: fetchDashboard,
      SETTINGS: fetchSettings
    };
    void loads[activeTab]?.();
  }, [activeTab, token]);

  // Counts for badges
  const pendingOrdersCount = orders.length
    ? orders.filter((o) => o.paymentStatus === 'WAITING_VERIFICATION').length
    : Number(dashboardData?.metrics?.pendingVerificationCount || 0);
  const pendingReturnsCount = returns.length
    ? returns.filter((r) => r.status === 'PENDING').length
    : Number(dashboardData?.metrics?.pendingReturnsCount || 0);
  const totalNotifications = pendingOrdersCount + pendingReturnsCount;

  // Jump from overview actions directly into targeted tab
  const handleNavigateTab = (tab: string, filter?: string) => {
    if (tab === 'ORDERS') {
      setOrderInitialFilter(filter || 'ALL');
      setActiveTab('ORDERS');
    } else if (tab === 'STOCK') {
      setActiveTab('STOCK');
    } else if (tab === 'RETURNS') {
      setActiveTab('RETURNS');
    } else if (tab === 'EXPENSES') {
      setActiveTab('EXPENSES');
    } else if (tab === 'PRODUCTS') {
      setActiveTab('PRODUCTS');
    } else if (tab === 'FINANCE' || tab === 'REPORTS') {
      setActiveTab('REPORTS');
    }
  };

  // Grouped Menu Navigation items (Compliant with Section 4)
  const navGroups = [
    {
      group: 'BISNIS',
      items: [
        { key: 'METRICS' as AdminTab, label: 'Ringkasan', icon: LayoutDashboard },
        {
          key: 'ORDERS' as AdminTab,
          label: 'Pesanan',
          icon: ShoppingBag,
          badge: pendingOrdersCount
        },
        { key: 'REPORTS' as AdminTab, label: 'Laporan', icon: FileSpreadsheet }
      ]
    },
    {
      group: 'KATALOG',
      items: [
        { key: 'PRODUCTS' as AdminTab, label: 'Produk', icon: Package },
        { key: 'CATEGORIES' as AdminTab, label: 'Kategori', icon: Layers },
        { key: 'STOCK' as AdminTab, label: 'Stok & Restock', icon: Boxes },
        { key: 'VOUCHERS' as AdminTab, label: 'Voucher', icon: Tag },
        { key: 'BANNERS' as AdminTab, label: 'Banner & Media', icon: ImageIcon }
      ]
    },
    {
      group: 'OPERASIONAL',
      items: [
        {
          key: 'RETURNS' as AdminTab,
          label: 'Retur & Refund',
          icon: RotateCcw,
          badge: pendingReturnsCount
        },
        { key: 'EXPENSES' as AdminTab, label: 'Biaya Usaha', icon: Receipt }
      ]
    },
    {
      group: 'PENGATURAN',
      items: [
        { key: 'SETTINGS' as AdminTab, label: 'Pengaturan', icon: Settings }
      ]
    }
  ];

  return (
    <div className="admin-mobile-shell min-h-screen bg-[#F6F5F2] text-[#24221F] flex flex-col md:flex-row text-left font-sans antialiased">

      {/* MOBILE TOP BAR */}
      <div className="md:hidden min-h-[58px] bg-white border-b border-[#E9E5DF] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/brand/defra-logo.svg"
            alt="Defra Logo"
            className="w-9 h-8 object-contain"
          />
          <div>
            <p className="text-[13px] font-semibold text-[#24221F]">Defra Owner</p>
            <p className="text-[11px] text-[#716B64]">Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalNotifications > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-[#B88770] animate-pulse" />
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-w-11 min-h-11 p-2 rounded-[10px] hover:bg-[#F6F5F2] text-[#24221F] flex items-center justify-center"
            aria-label="Toggle Menu Admin"
          >
            {mobileMenuOpen ? <X className="w-[22px] h-[22px]" /> : <Menu className="w-[22px] h-[22px]" />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER NAVIGATION */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[58px] bg-white z-50 p-4 space-y-4 overflow-y-auto border-b border-[#E9E5DF] shadow-xl">
          {navGroups.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <span className="text-[10px] font-semibold text-[#716B64]/70 tracking-wider uppercase px-2">
                {grp.group}
              </span>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-11 flex items-center justify-between px-3 py-2.5 rounded-[10px] font-medium text-[13px] transition-colors ${isActive
                        ? 'bg-[#24221F] text-white shadow-xs'
                        : 'text-[#716B64] hover:bg-[#F6F5F2] hover:text-[#24221F]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-[#B88770]' : 'text-[#716B64]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="px-2 py-0.5 bg-[#B88770] text-white text-[10px] rounded-full font-bold">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="pt-4 border-t border-[#E9E5DF] space-y-2 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="w-full text-left py-2 text-[#716B64] flex items-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Lihat Toko Publik</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full text-left py-2 text-[#B33D39] font-medium flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun Owner</span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR NAVIGATION (Fixed 224px, Full Viewport Height, Padding 16px) */}
      <aside className="hidden md:flex w-[224px] bg-white border-r border-[#E9E5DF] p-4 flex-col justify-between shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto shadow-[0_6px_24px_rgba(36,34,31,.02)] select-none">
        <div className="space-y-6">
          {/* Real DE Logo + Defra Owner */}
          <div className="flex items-center gap-3 px-2 py-1">
            <img
              src="/assets/brand/defra-logo.svg"
              alt="Defra Logo"
              className="w-8 h-7 object-contain"
            />
            <div>
              <p className="text-xs font-semibold text-[#24221F] tracking-tight">Defra Owner</p>
              <p className="text-[10px] text-[#716B64]">Workspace</p>
            </div>
          </div>

          {/* Grouped Menu Navigation */}
          <nav className="space-y-5 text-xs font-medium">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-[#716B64]/70 uppercase">
                  {grp.group}
                </div>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      className={`w-full h-[42px] flex items-center justify-between px-3 rounded-[10px] transition-all text-left ${isActive
                          ? 'bg-[#24221F] text-white shadow-[0_4px_12px_rgba(36,34,31,0.12)]'
                          : 'text-[#716B64] hover:bg-[#F6F5F2] hover:text-[#24221F]'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-[#B88770]' : 'text-[#716B64]'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="px-2 py-0.5 bg-[#B88770] text-white text-[10px] rounded-full font-bold">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-[#E9E5DF] space-y-1 text-xs">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full text-left px-3 py-2 text-[#716B64] hover:text-[#24221F] hover:bg-[#F6F5F2] rounded-[10px] transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Lihat Toko Publik</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-[#B33D39] hover:bg-[#FAECEA] rounded-[10px] font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* MAIN ADMIN WORKSPACE (Padding 28px desktop, max-width 1560px, gap 20px) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#F8F7F4] bg-[radial-gradient(ellipse_80%_50%_at_50%_-12%,rgba(216,162,143,0.14),transparent_65%),radial-gradient(ellipse_60%_40%_at_92%_12%,rgba(235,212,185,0.12),transparent_55%)] relative">

        {/* TOP TOOLBAR: Liquid Glass (~56px height, translucent background, blur, thin highlight, soft shadow) */}
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-white/60 shadow-[0_4px_20px_-4px_rgba(36,34,31,0.03)] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          {/* Functional Search Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pencarian cepat nomor pesanan, produk, atau menu..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = (e.target as HTMLInputElement).value.trim();
                    if (q) {
                      setOrderInitialFilter('ALL');
                      setActiveTab('ORDERS');
                    }
                  }
                }}
                className="w-full h-9 pl-9 pr-3 bg-white/70 border border-[#E9E5DF]/80 rounded-[10px] text-xs text-[#24221F] placeholder:text-[#716B64] outline-none focus:border-[#87533F] focus:bg-white transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-4">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="p-2 rounded-[10px] text-[#716B64] hover:text-[#24221F] hover:bg-white/80 relative transition-colors"
                aria-label="Notifikasi Pengelola"
              >
                <Bell className="w-4 h-4" />
                {totalNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#B88770] rounded-full" />
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white/95 backdrop-blur-xl border border-[#E9E5DF]/80 rounded-[16px] shadow-[0_12px_36px_rgba(36,34,31,0.08)] p-3 z-50 text-xs space-y-2 motion-dropdown">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E9E5DF]">
                    <span className="font-semibold text-[#24221F]">Notifikasi Prioritas</span>
                    <span className="text-[10px] text-[#716B64] font-sans">{totalNotifications} item aktif</span>
                  </div>

                  {totalNotifications === 0 ? (
                    <p className="text-[#716B64] py-3 text-center text-xs">
                      Semua antrean operasional telah tertangani.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E9E5DF]/60">
                      {pendingOrdersCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationOpen(false);
                            handleNavigateTab('ORDERS', 'WAITING_VERIFICATION');
                          }}
                          className="w-full py-2.5 px-2 hover:bg-[#FAF9F7]/70 rounded-[8px] text-left transition-colors flex items-center justify-between"
                        >
                          <span className="text-[#24221F]">Bukti bayar menunggu review</span>
                          <span className="px-2 py-0.5 bg-[#FEF7EA] text-[#94691E] rounded-full font-bold text-[10px]">
                            {pendingOrdersCount}
                          </span>
                        </button>
                      )}

                      {pendingReturnsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationOpen(false);
                            handleNavigateTab('RETURNS');
                          }}
                          className="w-full py-2.5 px-2 hover:bg-[#FAF9F7]/70 rounded-[8px] text-left transition-colors flex items-center justify-between"
                        >
                          <span className="text-[#24221F]">Pengajuan retur baru</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-[#426BC6] rounded-full font-bold text-[10px]">
                            {pendingReturnsCount}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Owner Identity Badge */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#E9E5DF]">
              <div className="w-8 h-8 rounded-full bg-[#24221F] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                DO
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-[#24221F] leading-tight">Defra Owner</p>
                <p className="text-[10px] text-[#26786C] font-medium leading-tight">Akun Pengelola</p>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN BODY AREA */}
        <main className="admin-main-content flex-1 p-3 sm:p-7 lg:p-8 max-w-[1560px] w-full mx-auto overflow-y-auto">
          {actionMessage && (
            <div className="mb-5 p-3.5 bg-[#E8F3EF] border border-[#26786C]/30 text-[#26786C] text-xs rounded-[12px] flex items-center gap-2.5 shadow-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-[#26786C] shrink-0" />
              <span className="font-semibold">{actionMessage}</span>
            </div>
          )}

          <div ref={tabMotionRef}>
          {/* TAB RENDERING */}
          {activeTab === 'METRICS' && (
            <AdminMetricsTab
              dashboardData={dashboardData}
              onRefresh={(s, e) => fetchDashboard(s, e)}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'ORDERS' && (
            <AdminOrdersTab
              orders={orders}
              token={token}
              initialFilter={orderInitialFilter}
              onRefresh={() => {
                fetchOrders();
                fetchDashboard();
                fetchReturns();
              }}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'PRODUCTS' && (
            <AdminProductsTab
              products={products}
              categories={categories}
              token={token}
              onRefresh={async () => { await Promise.all([fetchProducts(), fetchDashboard()]); invalidateStorefrontData(); }}
              onShowMessage={showMessage}
              onManageStock={() => setActiveTab('STOCK')}
            />
          )}

          {activeTab === 'CATEGORIES' && (
            <AdminCategoriesTab
              categories={categories}
              token={token}
              onRefresh={async () => { await Promise.all([fetchCategories(), fetchProducts()]); invalidateStorefrontData(); }}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'STOCK' && (
            <AdminStockTab
              products={products}
              token={token}
              onRefresh={() => Promise.all([fetchProducts(), fetchDashboard()]).then(() => undefined)}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'VOUCHERS' && (
            <AdminVouchersTab
              vouchers={vouchers}
              categories={categories}
              products={products}
              token={token}
              onRefresh={fetchVouchers}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'BANNERS' && (
            <>
              <AdminBannersTab banners={banners} token={token} onRefresh={fetchBanners} onShowMessage={showMessage}/>
              <AdminCommunityMedia campaign={campaignGallery} reels={communityReels} token={token} onRefresh={fetchBanners} onShowMessage={showMessage}/>
            </>
          )}

          {activeTab === 'RETURNS' && (
            <AdminReturnsTab
              returns={returns}
              token={token}
              onRefresh={() => {
                fetchReturns();
                fetchOrders();
                fetchDashboard();
              }}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'EXPENSES' && (
            <AdminExpensesTab
              dashboardData={dashboardData}
              token={token}
              onRefresh={(s, e) => fetchDashboard(s, e)}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'REPORTS' && (
            <AdminFinanceTab
              dashboardData={dashboardData}
              token={token}
              onRefresh={(s, e) => fetchDashboard(s, e)}
              onShowMessage={showMessage}
            />
          )}

          {activeTab === 'SETTINGS' && settings && (
            <AdminSettingsTab
              settings={settings}
              token={token}
              onRefresh={fetchSettings}
              onShowMessage={showMessage}
            />
          )}
          </div>
        </main>
      </div>
      <AdminMobileBottomNav
        activeTab={activeTab}
        onSelect={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
};

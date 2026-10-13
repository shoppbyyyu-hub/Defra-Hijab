import React from 'react';
import { LayoutDashboard, Package, Receipt, RotateCcw, ShoppingBag } from 'lucide-react';

export type MobileAdminTab = 'EXPENSES' | 'ORDERS' | 'METRICS' | 'PRODUCTS' | 'RETURNS';

interface AdminMobileBottomNavProps {
  activeTab: string;
  onSelect: (tab: MobileAdminTab) => void;
}

const items = [
  { key: 'EXPENSES' as const, label: 'Biaya', title: 'Biaya Usaha', icon: Receipt },
  { key: 'ORDERS' as const, label: 'Pesanan', title: 'Pesanan', icon: ShoppingBag },
  { key: 'METRICS' as const, label: 'Dashboard', title: 'Dashboard', icon: LayoutDashboard, primary: true },
  { key: 'PRODUCTS' as const, label: 'Produk', title: 'Produk', icon: Package },
  { key: 'RETURNS' as const, label: 'Retur', title: 'Retur', icon: RotateCcw }
];

export const AdminMobileBottomNav: React.FC<AdminMobileBottomNavProps> = ({ activeTab, onSelect }) => (
  <nav className="admin-mobile-bottom-nav" aria-label="Navigasi utama admin">
    {items.map((item) => {
      const Icon = item.icon;
      const active = activeTab === item.key;
      return (
        <button
          key={item.key}
          type="button"
          title={item.title}
          aria-label={item.title}
          aria-current={active ? 'page' : undefined}
          onClick={() => onSelect(item.key)}
          className={`admin-mobile-bottom-nav__item ${active ? 'is-active' : ''}`}
        >
          <span className="admin-mobile-bottom-nav__icon"><Icon aria-hidden="true" /></span>
          <span>{item.label}</span>
        </button>
      );
    })}
  </nav>
);

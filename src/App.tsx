import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { CartProvider } from './context/CartContext.tsx';
import { HomeView } from './views/HomeView.tsx';
import { CatalogView } from './views/CatalogView.tsx';
import { ProductDetailView } from './views/ProductDetailView.tsx';
import { CheckoutView } from './views/CheckoutView.tsx';
import { OrderConfirmationView } from './views/OrderConfirmationView.tsx';
import { CheckStatusView } from './views/CheckStatusView.tsx';
import { ReturnPolicyView } from './views/ReturnPolicyView.tsx';
import { AdminLoginView } from './views/AdminLoginView.tsx';
const OwnerDashboardView = lazy(() => import('./views/OwnerDashboardView.tsx').then((module) => ({ default: module.OwnerDashboardView })));

export default function App() {
  const pageMotionRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('defra_owner_token');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const page = pageMotionRef.current;
    if (!page) return;
    page.classList.remove('motion-page-enter');
    void page.offsetWidth;
    page.classList.add('motion-page-enter');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (!('IntersectionObserver' in window)) return;
    const revealFallbacks = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('motion-reveal-pending');
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const register = (root: ParentNode) => {
      const targets = root instanceof HTMLElement && root.matches('[data-reveal]')
        ? [root]
        : Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
      targets.forEach((target) => {
        if (target.dataset.revealObserved === 'true') return;
        target.dataset.revealObserved = 'true';
        target.classList.add('motion-reveal-pending');
        observer.observe(target);
        const fallback = window.setTimeout(() => {
          target.classList.remove('motion-reveal-pending');
          target.classList.add('is-revealed');
          observer.unobserve(target);
        }, 4000);
        revealFallbacks.add(fallback);
      });
    };
    register(page);
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) register(node);
      }));
    });
    mutations.observe(page, { childList: true, subtree: true });
    return () => { mutations.disconnect(); observer.disconnect(); revealFallbacks.forEach((timer) => window.clearTimeout(timer)); };
  }, [currentPath]);

  useEffect(() => {
    if (!currentPath.startsWith('/defraowner') && currentPath !== '/Entrance') return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.token) {
          sessionStorage.setItem('defra_owner_token', data.token);
          setAdminToken(data.token);
        }
      } catch {}
    };
    void refresh();
    const timer = setInterval(refresh, 45 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [currentPath]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (token: string) => {
    sessionStorage.setItem('defra_owner_token', token);
    setAdminToken(token);
    navigate('/defraowner');
  };

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('defra_owner_token');
    setAdminToken(null);
    navigate('/Entrance');
  };

  // Route Dispatching
  const renderRoute = () => {
    const path = currentPath;

    // 1. EXACT ROUTE: /Entrance (Admin Login)
    if (path === '/Entrance') {
      return <AdminLoginView onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />;
    }

    // 2. EXACT ROUTE: /defraowner (Owner Dashboard, strictly protected)
    if (path.startsWith('/defraowner')) {
      if (!adminToken) {
        // Unauthorized -> redirect strictly to /Entrance
        return <AdminLoginView onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />;
      }
      return (
        <OwnerDashboardView
          token={adminToken}
          onLogout={handleLogout}
          onNavigate={navigate}
        />
      );
    }

    // 3. Product Detail: /produk/:id
    if (path.startsWith('/produk/')) {
      const productId = path.replace('/produk/', '').split('?')[0];
      return <ProductDetailView productId={productId} onNavigate={navigate} />;
    }

    // 4. Order Confirmation: /pesanan/:orderNumber
    if (path.startsWith('/pesanan/')) {
      const orderNumber = path.replace('/pesanan/', '').split('?')[0];
      return <OrderConfirmationView orderNumber={orderNumber} onNavigate={navigate} />;
    }

    // 5. Checkout
    if (path === '/checkout') {
      return <CheckoutView onNavigate={navigate} />;
    }

    // 6. Check Order Status
    if (path === '/cek-status') {
      return <CheckStatusView onNavigate={navigate} />;
    }

    // 7. Return Policy & Submission
    if (path.startsWith('/retur')) {
      const params = new URLSearchParams(window.location.search);
      const initialOrder = params.get('order') || '';
      return <ReturnPolicyView onNavigate={navigate} initialOrderNumber={initialOrder} />;
    }

    // 8. Catalog: /katalog
    if (path.startsWith('/katalog')) {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('cat') || undefined;
      const isWishlist = params.get('filter') === 'wishlist';
      return (
        <CatalogView
          onNavigate={navigate}
          initialCategory={cat}
          isWishlistView={isWishlist}
        />
      );
    }

    // Default: Storefront Homepage
    return <HomeView onNavigate={navigate} />;
  };

  return <CartProvider><Suspense fallback={<div className="min-h-screen bg-[#F6F5F2]"/>}><div ref={pageMotionRef}>{renderRoute()}</div></Suspense></CartProvider>;
}

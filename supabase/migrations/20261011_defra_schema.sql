-- ==============================================================================
-- DEFRA HIJAB — Production Schema & Security Rules (PostgreSQL / Supabase)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PENGATURAN TOKO & ADMIN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS defra_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    whatsapp_number TEXT NOT NULL DEFAULT '6281234567890',
    origin_province TEXT NOT NULL DEFAULT 'DKI Jakarta',
    origin_city TEXT NOT NULL DEFAULT 'Jakarta Selatan',
    origin_city_id TEXT NOT NULL DEFAULT '153',
    origin_subdistrict TEXT NOT NULL DEFAULT 'Kebayoran Baru',
    origin_address TEXT NOT NULL DEFAULT 'Jl. Senopati No. 88',
    qris_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bank_transfer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bank_name TEXT NOT NULL DEFAULT 'BCA',
    bank_account_number TEXT NOT NULL DEFAULT '1234567890',
    bank_account_holder TEXT NOT NULL DEFAULT 'DEFRA HIJAB OFFICIAL',
    low_stock_threshold INT NOT NULL DEFAULT 3,
    telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial default settings
INSERT INTO defra_settings (id, whatsapp_number, origin_province, origin_city, origin_city_id)
VALUES ('current', '6281234567890', 'DKI Jakarta', 'Jakarta Selatan', '153')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. KATEGORI & PRODUK
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    weight_grams INT NOT NULL DEFAULT 200 CHECK (weight_grams > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color TEXT NOT NULL,
    color_hex TEXT DEFAULT '#FFFFFF',
    size TEXT NOT NULL DEFAULT 'All Size',
    sku TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FIFO Inventory Batches (Mencatat HPP per batch restock)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    batch_code TEXT NOT NULL,
    initial_qty INT NOT NULL CHECK (initial_qty > 0),
    remaining_qty INT NOT NULL CHECK (remaining_qty >= 0),
    cost_per_unit NUMERIC(12, 2) NOT NULL CHECK (cost_per_unit >= 0),
    arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. KONTEN STOREFRONT (HERO, GALLERY, REELS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hero_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    desktop_image_url TEXT NOT NULL,
    mobile_image_url TEXT NOT NULL,
    focal_x INT NOT NULL DEFAULT 50,
    focal_y INT NOT NULL DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '2:1', -- '2:1' atau '4:5'
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_video_id TEXT NOT NULL,
    poster_image_url TEXT,
    title TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. VOUCHER & PROMO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    promo_name TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('NOMINAL', 'PERCENTAGE')),
    discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(12, 2),
    scope TEXT NOT NULL CHECK (scope IN ('ALL', 'CATEGORY', 'PRODUCT')),
    target_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    target_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quota INT NOT NULL CHECK (quota >= 0),
    reserved_quota INT NOT NULL DEFAULT 0 CHECK (reserved_quota >= 0),
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. RESERVASI (24 JAM ATOMIK SEBELUM PESANAN RESMI)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_fee NUMERIC(12, 2) NOT NULL,
    shipping_service TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    voucher_id UUID REFERENCES vouchers(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
    items_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_session ON reservations(session_token);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON reservations(expires_at) WHERE status = 'ACTIVE';

-- ------------------------------------------------------------------------------
-- 6. PESANAN & TRANSAKSI
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE, -- Kriptografis acak kuat
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_whatsapp TEXT NOT NULL,
    customer_birth_date DATE NOT NULL,
    address_line TEXT NOT NULL,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    subdistrict TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_fee NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('QRIS', 'BANK_TRANSFER')),
    payment_status TEXT NOT NULL DEFAULT 'WAITING_VERIFICATION' CHECK (payment_status IN ('WAITING_VERIFICATION', 'REVISION_REQUESTED', 'VERIFIED', 'REFUNDED_PARTIAL', 'REFUNDED_FULL')),
    fulfillment_status TEXT NOT NULL DEFAULT 'WAITING_PAYMENT_VERIFIED' CHECK (fulfillment_status IN ('WAITING_PAYMENT_VERIFIED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    payment_proof_url TEXT NOT NULL,
    payment_proof_mime TEXT NOT NULL,
    rejection_reason TEXT,
    rejection_deadline TIMESTAMPTZ,
    actual_delivery_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index komposit untuk pencarian cek status (ketiganya wajib cocok)
CREATE INDEX IF NOT EXISTS idx_orders_lookup ON orders(order_number, customer_email, customer_whatsapp);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id),
    product_name TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(12, 2) NOT NULL,
    allocated_batches JSONB NOT NULL, -- Menyimpan alokasi HPP FIFO
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    packaging_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_actual_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_subsidy NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS periodic_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. RETUR & REFUND (MAKS 3 HARI DARI DELIVERED)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    return_number TEXT NOT NULL UNIQUE,
    requested_resolution TEXT NOT NULL CHECK (requested_resolution IN ('REFUND', 'REPLACEMENT')),
    reason_category TEXT NOT NULL CHECK (reason_category IN ('WRONG_ITEM', 'DAMAGED', 'DEFECTIVE')),
    customer_notes TEXT NOT NULL,
    proof_image_urls JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED_INSPECTED', 'COMPLETED')),
    admin_notes TEXT,
    inspection_result TEXT CHECK (inspection_result IN ('RESTOCKED_GOOD', 'RECORDED_DAMAGED_LOSS')),
    received_date TIMESTAMPTZ,
    resolved_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    condition TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. AUDIT LOG
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE defra_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodic_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Publik hanya membaca produk dan konten aktif
CREATE POLICY "Public read active categories" ON categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read active products" ON products FOR SELECT USING (is_active = TRUE AND is_archived = FALSE);
CREATE POLICY "Public read active variants" ON product_variants FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read hero banners" ON hero_banners FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read gallery" ON campaign_gallery FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read reels" ON community_reels FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read settings" ON defra_settings FOR SELECT USING (id = 'current');

-- Service role bypasses RLS for atomic server procedures

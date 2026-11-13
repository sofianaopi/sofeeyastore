-- =====================================================================
--  SOFEEYA STORE POS — Database MySQL / MariaDB
--  Cara pakai: Hostinger hPanel → Databases → phpMyAdmin → pilih database
--  → tab "Import" → pilih file ini → Go.
--  Akun awal : admin@toko.com / admin12345  (SEGERA ganti kata sandi!)
--              kasir@toko.com / kasir12345
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'kasir',
  promo_access TINYINT(1) NOT NULL DEFAULT 0,
  cek_stok_access TINYINT(1) NOT NULL DEFAULT 0,
  bank_name VARCHAR(100) NOT NULL DEFAULT '',
  bank_account VARCHAR(100) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  barcode VARCHAR(100) NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT '',
  cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  price DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  image VARCHAR(500) NOT NULL DEFAULT '',
  stock_in_date DATE NULL,
  model VARCHAR(200) NOT NULL DEFAULT '',
  size VARCHAR(30) NOT NULL DEFAULT '',
  color VARCHAR(40) NOT NULL DEFAULT '',
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_products_barcode (barcode),
  INDEX idx_products_category (category),
  INDEX idx_products_model (model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'percent',   -- percent | fixed | price | package | bogo
  value DECIMAL(14,2) NOT NULL DEFAULT 0,
  min_purchase DECIMAL(14,2) NOT NULL DEFAULT 0,
  min_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  buy_qty INT NOT NULL DEFAULT 1,
  free_qty INT NOT NULL DEFAULT 1,
  free_category VARCHAR(100) NOT NULL DEFAULT '',
  categories TEXT NULL,          -- JSON array
  product_ids TEXT NULL,         -- JSON array
  free_product_ids TEXT NULL,    -- JSON array
  code VARCHAR(50) NOT NULL DEFAULT '',
  stackable TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  start_date DATE NULL,
  end_date DATE NULL,
  badge_text VARCHAR(20) NOT NULL DEFAULT '',
  badge_color VARCHAR(20) NOT NULL DEFAULT '',
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  email VARCHAR(200) NOT NULL DEFAULT '',
  points INT NOT NULL DEFAULT 0,
  voucher_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  voucher_used TINYINT(1) NOT NULL DEFAULT 0,
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_members_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS point_rewards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'discount',  -- discount | product
  points_required INT NOT NULL DEFAULT 1,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  product_name VARCHAR(200) NOT NULL DEFAULT '',
  product_barcode VARCHAR(100) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice VARCHAR(50) NOT NULL UNIQUE,
  items LONGTEXT NULL,             -- JSON array of cart lines
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  fee_note VARCHAR(500) NOT NULL DEFAULT '',
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment DECIMAL(14,2) NOT NULL DEFAULT 0,
  `change` DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  promo_name VARCHAR(500) NOT NULL DEFAULT '',
  item_count INT NOT NULL DEFAULT 0,
  member_id INT UNSIGNED NULL,
  member_name VARCHAR(200) NOT NULL DEFAULT '',
  points_earned INT NOT NULL DEFAULT 0,
  points_used INT NOT NULL DEFAULT 0,
  member_points_after INT NOT NULL DEFAULT 0,
  cashier VARCHAR(200) NOT NULL DEFAULT '',
  cashier_id INT UNSIGNED NULL,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  sales_name VARCHAR(200) NOT NULL DEFAULT '',
  sales_code VARCHAR(50) NOT NULL DEFAULT '',
  commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  note VARCHAR(1000) NOT NULL DEFAULT '',
  channel VARCHAR(30) NOT NULL DEFAULT 'Toko',
  return_ref VARCHAR(50) NOT NULL DEFAULT '',
  return_items TEXT NULL,
  return_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  returned TEXT NULL,
  client_ref VARCHAR(40) NOT NULL DEFAULT '',
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_tx_created (created),
  INDEX idx_tx_client_ref (client_ref),
  INDEX idx_tx_sales (sales_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(200) NOT NULL DEFAULT '',
  barcode VARCHAR(100) NOT NULL DEFAULT '',
  type VARCHAR(10) NOT NULL DEFAULT 'in',     -- in | out
  quantity INT NOT NULL DEFAULT 0,
  stock_before INT NOT NULL DEFAULT 0,
  stock_after INT NOT NULL DEFAULT 0,
  cashier VARCHAR(200) NOT NULL DEFAULT '',
  invoice VARCHAR(50) NOT NULL DEFAULT '',
  note VARCHAR(500) NOT NULL DEFAULT '',
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_sm_product (product_id),
  INDEX idx_sm_created (created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  user_name VARCHAR(200) NOT NULL DEFAULT '',
  type VARCHAR(5) NOT NULL DEFAULT 'in',      -- in | out
  lat DOUBLE NULL,
  lng DOUBLE NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_att_user (user_id),
  INDEX idx_att_created (created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_checks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  petugas_id INT UNSIGNED NULL,
  petugas_name VARCHAR(200) NOT NULL DEFAULT '',
  items LONGTEXT NULL,             -- JSON array
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  note VARCHAR(1000) NOT NULL DEFAULT '',
  reviewed_by INT UNSIGNED NULL,
  reviewed_name VARCHAR(200) NOT NULL DEFAULT '',
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_sc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_info (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT '',
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NULL,
  created DATETIME NULL,
  updated DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NULL,
  invoice VARCHAR(50) NOT NULL DEFAULT '',
  courier VARCHAR(60) NOT NULL DEFAULT '',
  recipient VARCHAR(200) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  address TEXT NULL,
  fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  resi VARCHAR(100) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'baru',   -- baru | dipesan | dikirim | selesai | batal
  note VARCHAR(500) NOT NULL DEFAULT '',
  cashier VARCHAR(200) NOT NULL DEFAULT '',
  provider VARCHAR(20) NOT NULL DEFAULT 'manual',   -- manual | biteship
  biteship_order_id VARCHAR(60) NOT NULL DEFAULT '',
  courier_code VARCHAR(30) NOT NULL DEFAULT '',
  courier_service VARCHAR(40) NOT NULL DEFAULT '',
  tracking_id VARCHAR(80) NOT NULL DEFAULT '',
  tracking_link VARCHAR(500) NOT NULL DEFAULT '',
  bs_status VARCHAR(40) NOT NULL DEFAULT '',
  driver VARCHAR(200) NOT NULL DEFAULT '',
  area_id VARCHAR(80) NOT NULL DEFAULT '',
  area_name VARCHAR(200) NOT NULL DEFAULT '',
  postal_code VARCHAR(10) NOT NULL DEFAULT '',
  lat DOUBLE NULL,
  lng DOUBLE NULL,
  weight INT NOT NULL DEFAULT 0,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created DATETIME NULL,
  updated DATETIME NULL,
  INDEX idx_ship_status (status),
  INDEX idx_ship_bs (biteship_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  triggered_by INT UNSIGNED NULL,
  target VARCHAR(50) NOT NULL DEFAULT 'all',
  created DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
--  Data awal
-- ---------------------------------------------------------------------
INSERT IGNORE INTO users (email, password_hash, name, role, promo_access, cek_stok_access, created, updated) VALUES
 ('admin@toko.com', '$2y$10$9wNpM0OD8ZLsfZZheVC76eDVu/0HwfeUWdRwWufeMmPd7tJMvPjM.', 'Administrator', 'admin', 1, 1, NOW(), NOW()),
 ('kasir@toko.com', '$2y$10$euaK9D/PA/mrx5nN7zc2TeMcsO/HkqlMVBM2nhCZe/FeaXZioavS6', 'Kasir', 'kasir', 0, 0, NOW(), NOW());

INSERT IGNORE INTO settings (`key`, value, created, updated) VALUES
 ('store_name', 'Sofeeya Store', NOW(), NOW()),
 ('supervisor_pin', '1234', NOW(), NOW()),
 ('points_per_amount', '1000', NOW(), NOW()),
 ('member_discount_percent', '0', NOW(), NOW()),
 ('member_offer_threshold', '200000', NOW(), NOW()),
 ('receipt_address', 'Andonohu, Kendari', NOW(), NOW()),
 ('receipt_phone', '', NOW(), NOW()),
 ('receipt_footer1', 'Terima kasih telah berbelanja', NOW(), NOW()),
 ('receipt_footer2', 'Tukar ukuran/warna maks. 7 hari dengan struk & label utuh', NOW(), NOW()),
 ('work_schedule', '{"startTime":"08:00","toleranceMinutes":15}', NOW(), NOW()),
 ('store_network', '{"ips":"","wifiName":""}', NOW(), NOW()),
 ('fee_presets', '[{"label":"Ongkir Maxim","amount":15000},{"label":"Ongkir Grab","amount":20000},{"label":"Ongkir J&T","amount":12000},{"label":"Bungkus kado","amount":5000}]', NOW(), NOW()),
 ('sales_channels', '["Toko","WhatsApp","Instagram","Shopee","TikTok Shop"]', NOW(), NOW()),
 ('size_sets', '["S, M, L, XL","XS, S, M, L, XL, XXL","All size","M, L, XL, XXL, 3XL","27, 28, 29, 30, 31, 32","36, 37, 38, 39, 40"]', NOW(), NOW()),
 ('return_days', '7', NOW(), NOW()),
 ('schema_version', '5', NOW(), NOW());

INSERT IGNORE INTO sales (name, code, active, created, updated) VALUES
 ('Sales 1', 'SLS01', 1, NOW(), NOW());

CREATE TABLE IF NOT EXISTS transfer_requests (
  id              serial PRIMARY KEY,
  title           text NOT NULL,
  payee_company   text NOT NULL,
  payer_company   text NOT NULL,
  due_date        text NOT NULL,
  status          text NOT NULL DEFAULT '未処理',
  amount          integer,
  pdf_url         text,
  requested_by_name text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Por ahora la app no gestiona pagos: se elimina la fecha de próximo pago.
-- La mensualidad (valor y modalidad) se conserva en public.clients.
-- =============================================================================

alter table public.clients drop column if exists next_payment_date;

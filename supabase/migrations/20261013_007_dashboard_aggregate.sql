-- Agregasi dashboard dikerjakan di database agar baris pesanan, item, batch,
-- dan biaya tidak dikirim seluruhnya ke proses Node.
create or replace function public.admin_dashboard_metrics(
  p_from date,
  p_to date,
  p_actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then
    raise exception 'OWNER_REQUIRED';
  end if;

  with ranged_orders as (
    select * from public.orders
    where created_at >= p_from::timestamptz
      and created_at < (p_to + 1)::timestamptz
  ), verified_orders as (
    select * from ranged_orders
    where payment_status in ('VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL')
  ), order_totals as (
    select
      coalesce(sum(subtotal-discount_amount),0) total_omzet,
      count(*) verified_count,
      coalesce(sum(discount_amount),0) total_discount
    from verified_orders
  ), unit_totals as (
    select coalesce(sum(oi.quantity),0) units
    from public.order_items oi join verified_orders vo on vo.id=oi.order_id
  ), hpp_totals as (
    select coalesce(sum(a.quantity*a.cost_per_unit),0) hpp
    from public.order_fifo_allocations a
    join public.order_items oi on oi.id=a.order_item_id
    join verified_orders vo on vo.id=oi.order_id
  ), direct_totals as (
    select coalesce(sum(c.packaging_cost+c.payment_fee+c.shipping_subsidy),0) direct_costs
    from public.order_costs c join verified_orders vo on vo.id=c.order_id
  ), expense_totals as (
    select coalesce(sum(amount),0) expenses from public.business_expenses
    where expense_date between p_from and p_to
  )
  select jsonb_build_object(
    'totalOmzet',ot.total_omzet,
    'totalOrders',(select count(*) from ranged_orders),
    'verifiedOrdersCount',ot.verified_count,
    'pendingVerificationCount',(select count(*) from ranged_orders where payment_status='WAITING_VERIFICATION'),
    'pendingReturnsCount',(select count(*) from public.return_requests where status='PENDING'),
    'totalUnitsSold',ut.units,
    'totalHPP',ht.hpp,
    'directCosts',dt.direct_costs,
    'totalOperationalExpenses',et.expenses,
    'totalRefunds',(select coalesce(sum(refund_amount),0) from ranged_orders),
    'totalDiscountGiven',ot.total_discount,
    'grossProfit',ot.total_omzet-ht.hpp,
    'netProfit',ot.total_omzet-ht.hpp-dt.direct_costs-et.expenses-(select coalesce(sum(refund_amount),0) from ranged_orders)
  ) into result
  from order_totals ot cross join unit_totals ut cross join hpp_totals ht cross join direct_totals dt cross join expense_totals et;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_metrics(date,date,uuid) from public, anon, authenticated;
grant execute on function public.admin_dashboard_metrics(date,date,uuid) to service_role;

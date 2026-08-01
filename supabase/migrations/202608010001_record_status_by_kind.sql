update public.property_records
set status = case
  when kind = 'offer' and status in ('for_sale', 'for_rent', 'sold_or_rented', 'archived') then status
  when kind = 'offer' and status in ('sold', 'rented', 'reserved') then 'sold_or_rented'
  when kind = 'offer' and status = 'closed' then 'archived'
  when kind = 'offer' and (transaction_type ilike '%rent%' or transaction_type ilike '%إيجار%' or transaction_type ilike '%ايجار%') then 'for_rent'
  when kind = 'offer' then 'for_sale'
  when kind = 'request' and status in ('purchase', 'rental', 'fulfilled', 'archived') then status
  when kind = 'request' and status in ('fulfilled', 'reserved') then 'fulfilled'
  when kind = 'request' and status = 'closed' then 'archived'
  when kind = 'request' and (transaction_type ilike '%rent%' or transaction_type ilike '%إيجار%' or transaction_type ilike '%ايجار%' or transaction_type ilike '%استئجار%') then 'rental'
  when kind = 'request' then 'purchase'
  else status
end
where status not in ('for_sale', 'for_rent', 'sold_or_rented', 'purchase', 'rental', 'fulfilled', 'archived');

alter table public.property_records
  drop constraint if exists property_records_status_by_kind;

alter table public.property_records
  add constraint property_records_status_by_kind check (
    (kind = 'offer' and status in ('for_sale', 'for_rent', 'sold_or_rented', 'archived'))
    or
    (kind = 'request' and status in ('purchase', 'rental', 'fulfilled', 'archived'))
  );


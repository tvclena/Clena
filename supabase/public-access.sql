-- Execute depois dos SQLs dos três editores.
-- Leitura pública apenas de páginas publicadas e dados ativos.
create policy "public read published stores" on public.stores for select to anon using (is_published=true);
create policy "public read store categories" on public.store_categories for select to anon using (exists(select 1 from public.stores s where s.id=store_id and s.is_published));
create policy "public read store products" on public.store_products for select to anon using (active and exists(select 1 from public.stores s where s.id=store_id and s.is_published));
create policy "public read store variations" on public.store_product_variations for select to anon using (exists(select 1 from public.store_products p join public.stores s on s.id=p.store_id where p.id=product_id and p.active and s.is_published));
create policy "public read delivery profiles" on public.delivery_profiles for select to anon using (is_published=true);
create policy "public read delivery categories" on public.delivery_categories for select to anon using (active and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published));
create policy "public read delivery items" on public.delivery_items for select to anon using (active and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published));
create policy "public read delivery addon groups" on public.delivery_addon_groups for select to anon using (active and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published));
create policy "public read delivery addon options" on public.delivery_addon_options for select to anon using (active and exists(select 1 from public.delivery_addon_groups g join public.delivery_profiles d on d.id=g.delivery_id where g.id=group_id and d.is_published));
create policy "public read delivery item addons" on public.delivery_item_addons for select to anon using (exists(select 1 from public.delivery_items i join public.delivery_profiles d on d.id=i.delivery_id where i.id=item_id and d.is_published));
create policy "public read delivery zones" on public.delivery_zones for select to anon using (active and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published));
create policy "public read delivery hours" on public.delivery_hours for select to anon using (exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published));
create policy "public create delivery order" on public.delivery_orders for insert to anon with check (exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published and d.owner_id=owner_id));
create policy "public create delivery order items" on public.delivery_order_items for insert to anon with check (exists(select 1 from public.delivery_orders o where o.id=order_id));
create policy "public read scheduling business" on public.scheduling_businesses for select to anon using (is_published=true);
create policy "public read scheduling services" on public.scheduling_services for select to anon using (is_active and exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_services.user_id and b.is_published));
create policy "public read scheduling resources" on public.scheduling_resources for select to anon using (is_active and exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_resources.user_id and b.is_published));
create policy "public read service resources" on public.scheduling_service_resources for select to anon using (exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_service_resources.user_id and b.is_published));
create policy "public read weekly hours" on public.scheduling_weekly_hours for select to anon using (exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_weekly_hours.user_id and b.is_published));
create policy "public read scheduling blocks" on public.scheduling_blocks for select to anon using (exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_blocks.user_id and b.is_published));
create policy "public read occupied appointments" on public.scheduling_appointments for select to anon using (exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_appointments.user_id and b.is_published));
create policy "public create customer" on public.scheduling_customers for insert to anon with check (exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_customers.user_id and b.is_published));
create policy "public create appointment" on public.scheduling_appointments for insert to anon with check (source='public' and exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_appointments.user_id and b.is_published));

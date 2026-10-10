-- Drywall walls (BR standard library): a default material list and fixings to other systems.
--  1. Standard recipe "Parede drywall – lista de materiais (BR)": what the framing layout does not count.
--     Coefficients per m² of wall (Catálogo Técnico Gypsum 2014, Parede Simples, 5% waste included):
--     joint compound and tape cover both faces (split between the face A and face B joint tasks).
--     Anchors and acoustic band are counted by the layout when the wall has fixings set; these lines are
--     the fallback for walls without framing.
--  2. Every standard BR drywall wall type (DW…) without a recipe gets it, plus default fixings:
--     anchors every 0.60 m (first at most 0.10 m from the track end) in the floor and ceiling slabs,
--     acoustic band under the floor track. Editable per item in the layer settings.
--  3. Project items already using those wall types (e.g. Test 1 DW03 / DW04) get the same.
-- Additive: nothing is deleted; existing recipes and fixings are kept.

insert into public.takeoff_recipes (organization_id, country_code, name, maker, system, kind, status, mode, waste_included_pct, height_basis_m, lines, source, notes)
select null, 'BR', 'Parede drywall – lista de materiais (BR)', null, 'Drywall', 'linear', 'review', 'fixed', 5, 2.5,
  '[
    {"mat":"Massa para tratamento de juntas","unit":"kg","coef":0.7,"base":"m2","waste":0,"packSize":30,"packName":"balde","step":"joints","note":"As duas faces (0,35 kg/m² por face)."},
    {"mat":"Fita de papel microperfurada 50 mm","unit":"m","coef":3,"base":"m2","waste":0,"packSize":150,"packName":"rolo","step":"joints","note":"As duas faces (1,5 m/m² por face)."},
    {"mat":"Bucha de nylon S6 + parafuso (fixação da guia)","unit":"un","coef":3.4,"base":"m","waste":0,"step":"framing","note":"Guia inferior e superior a cada 0,60 m. Contado pela paginação quando a parede tem fixação configurada."},
    {"mat":"Banda acústica","unit":"m","coef":1,"base":"m","waste":0,"step":"framing","note":"Sob a guia inferior. Contada pela paginação quando a parede tem fixação configurada."}
  ]'::jsonb,
  '{"basis":"Catálogo Técnico Gypsum Drywall 2014, Parede Simples, Tabela de Consumo (m²)","pdfPage":36,"printedPage":34}'::jsonb,
  'Montantes, guias, chapas e parafusos vêm da paginação da estrutura. Coeficientes por m² de parede; tratamento de juntas nas duas faces.'
where not exists (select 1 from public.takeoff_recipes r where r.organization_id is null and r.country_code = 'BR' and r.name = 'Parede drywall – lista de materiais (BR)');

-- 2. Standard BR drywall wall types.
update public.takeoff_wall_types w
set recipe_id = coalesce(w.recipe_id, (select r.id from public.takeoff_recipes r where r.organization_id is null and r.country_code = 'BR' and r.name = 'Parede drywall – lista de materiais (BR)' order by r.created_at limit 1)),
    framing = case when coalesce(w.framing, '{}'::jsonb) ? 'fixings' then w.framing
      else coalesce(w.framing, '{}'::jsonb) || jsonb_build_object('fixings', jsonb_build_object(
        'anchorSpacing', 0.6, 'anchorEdge', 0.1,
        'anchorAt', jsonb_build_object('floor', true, 'ceiling', true, 'walls', false),
        'anchorName', 'Bucha de nylon S6 + parafuso (fixação da guia)',
        'bandAt', jsonb_build_object('floor', true, 'ceiling', false, 'walls', false),
        'bandName', 'Banda acústica', 'bandRoll', null)) end
where w.organization_id is null and w.project_id is null and w.country_code = 'BR' and w.code ~* '^DW[0-9]+$';

-- 3. Project items using those wall types.
update public.takeoff_layers l
set recipe_id = coalesce(l.recipe_id, w.recipe_id),
    framing = case when coalesce(l.framing, '{}'::jsonb) ? 'fixings' or coalesce(l.framing->>'on', 'false') <> 'true' then l.framing
      else l.framing || jsonb_build_object('fixings', w.framing->'fixings') end
from public.takeoff_wall_types w
where l.wall_type_id = w.id and l.kind = 'linear'
  and w.organization_id is null and w.project_id is null and w.country_code = 'BR' and w.code ~* '^DW[0-9]+$';

notify pgrst, 'reload schema';

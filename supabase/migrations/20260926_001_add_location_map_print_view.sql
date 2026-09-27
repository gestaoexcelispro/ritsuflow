alter table public.project_drawing_maps
  add column if not exists print_view jsonb;

comment on column public.project_drawing_maps.print_view is
  'Normalized PDF crop rectangle used by printed location cards: {x,y,width,height}.';

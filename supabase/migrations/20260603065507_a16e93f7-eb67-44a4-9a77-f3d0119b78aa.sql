
ALTER TABLE public.timetable
  DROP CONSTRAINT IF EXISTS timetable_period_type_check;

ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_period_type_check
  CHECK (period_type IN ('lesson','short_break','long_break','assembly','lunch','closing'));

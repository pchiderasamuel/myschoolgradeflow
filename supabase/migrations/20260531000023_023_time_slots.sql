-- =====================================================================
-- 023: time_slots — school-wide configurable time slot templates
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.time_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  label         TEXT NOT NULL, -- e.g., "Period 1", "Morning Break", "Assembly"
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  slot_type     TEXT NOT NULL DEFAULT 'lesson'
                CHECK (slot_type IN ('lesson','break','assembly','lunch','closing')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_slots_school ON public.time_slots(school_id, sort_order);

ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

-- All teaching staff can read their school's time slots
CREATE POLICY "time_slots_read_staff"
  ON public.time_slots FOR SELECT
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('superadmin','school_admin','principal','head_teacher','teacher')
  );

-- School admins can insert time slots
CREATE POLICY "time_slots_insert"
  ON public.time_slots FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('superadmin','school_admin','principal')
  );

-- School admins can update time slots
CREATE POLICY "time_slots_update"
  ON public.time_slots FOR UPDATE
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('superadmin','school_admin','principal')
  );

-- School admins can delete time slots
CREATE POLICY "time_slots_delete"
  ON public.time_slots FOR DELETE
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('superadmin','school_admin','principal')
  );

CREATE TRIGGER trg_time_slots_updated
  BEFORE UPDATE ON public.time_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- Migration: Prevent Teacher and Room Double-Booking
-- Adds robust conflict-detection logic to the timetable table via triggers.
-- =====================================================================

-- 1. Function to check for teacher double booking
CREATE OR REPLACE FUNCTION public.check_timetable_conflict()
RETURNS TRIGGER AS $$
DECLARE
  conflict_class_name TEXT;
BEGIN
  -- 0. Validate time bounds
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Invalid Time: Start time (%) must be before end time (%).', NEW.start_time, NEW.end_time
    USING ERRCODE = 'P0003';
  END IF;

  -- A. Check Teacher Conflict
  -- If this slot has a teacher assigned
  IF NEW.teacher_id IS NOT NULL THEN
    -- Check if this teacher is already assigned to a DIFFERENT class at the SAME time in the SAME school/term/year
    SELECT class_name INTO conflict_class_name
    FROM public.timetable
    WHERE school_id = NEW.school_id
      AND teacher_id = NEW.teacher_id
      AND day = NEW.day
      AND period_number = NEW.period_number
      AND academic_year = NEW.academic_year
      AND term = NEW.term
      AND id != NEW.id -- ignore self if updating
      AND class_id != NEW.class_id;

    IF FOUND THEN
      RAISE EXCEPTION 'Double Booking: Teacher is already assigned to class "%" at this time.', conflict_class_name
      USING ERRCODE = 'P0001'; -- generic exception
    END IF;
  END IF;

  -- B. Check Room Conflict
  -- If this slot specifies a room
  IF NEW.room IS NOT NULL AND trim(NEW.room) != '' THEN
    -- Check if this room is already booked by a DIFFERENT class at the SAME time
    SELECT class_name INTO conflict_class_name
    FROM public.timetable
    WHERE school_id = NEW.school_id
      AND lower(trim(room)) = lower(trim(NEW.room))
      AND day = NEW.day
      AND period_number = NEW.period_number
      AND academic_year = NEW.academic_year
      AND term = NEW.term
      AND id != NEW.id
      AND class_id != NEW.class_id;

    IF FOUND THEN
      RAISE EXCEPTION 'Double Booking: Room "%" is already booked by class "%" at this time.', NEW.room, conflict_class_name
      USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to the timetable table
DROP TRIGGER IF EXISTS trg_prevent_timetable_conflict ON public.timetable;

CREATE TRIGGER trg_prevent_timetable_conflict
BEFORE INSERT OR UPDATE ON public.timetable
FOR EACH ROW
EXECUTE FUNCTION public.check_timetable_conflict();

CREATE OR REPLACE FUNCTION public.carepulse_appointment_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_run_id uuid; v_patient public.patients%ROWTYPE; v_clinic public.clinics%ROWTYPE; v_doctor_name text; v_reference text; v_token text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'confirmed' THEN RETURN NEW; END IF;
  INSERT INTO public.automation_runs (clinic_id, workflow_name, status, related_reference, trigger_key)
  VALUES (NEW.clinic_id, 'Appointment confirmation', 'pending', NEW.id::text, 'appointment-confirmed:' || NEW.id::text)
  ON CONFLICT (trigger_key) DO NOTHING RETURNING id INTO v_run_id;
  IF v_run_id IS NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT * INTO v_patient FROM public.patients WHERE id = NEW.patient_id;
    SELECT * INTO v_clinic FROM public.clinics WHERE id = NEW.clinic_id;
    IF NEW.doctor_id IS NOT NULL THEN SELECT full_name INTO v_doctor_name FROM public.doctors WHERE id = NEW.doctor_id; END IF;
    v_reference := 'CP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.appointment_passes (clinic_id, appointment_id, patient_id, reference_code, qr_code)
    VALUES (NEW.clinic_id, NEW.id, NEW.patient_id, v_reference, v_token)
    ON CONFLICT (appointment_id) DO NOTHING;
    INSERT INTO public.notifications (clinic_id, user_id, patient_id, title, message, notification_type, is_read)
    VALUES (NEW.clinic_id, v_patient.auth_user_id, NEW.patient_id, 'Appointment confirmed', 'Your appointment at ' || v_clinic.name || ' on ' || to_char(NEW.appointment_date, 'Mon FMDD, YYYY') || ' at ' || to_char(NEW.appointment_time, 'FMHH12:MI AM') || ' is confirmed. Reference: ' || v_reference || '.', 'appointment_confirmed', false);
    UPDATE public.automation_runs SET status = 'success', completed_at = now() WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.automation_runs SET status = 'failed', error_message = SQLSTATE || ': ' || SQLERRM, completed_at = now() WHERE id = v_run_id;
  END;
  RETURN NEW;
END;
$function$;
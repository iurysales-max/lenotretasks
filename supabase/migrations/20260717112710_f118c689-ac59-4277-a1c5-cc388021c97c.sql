
CREATE TABLE public.candidate_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  position INTEGER NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.candidate_status TO authenticated;
GRANT ALL ON public.candidate_status TO service_role;
ALTER TABLE public.candidate_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status readable by auth" ON public.candidate_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "status admin manage" ON public.candidate_status FOR ALL TO authenticated
  USING (public.is_admin_or_rh(auth.uid())) WITH CHECK (public.is_admin_or_rh(auth.uid()));

INSERT INTO public.candidate_status (name, color, position, is_terminal) VALUES
  ('Novo', '#3b82f6', 0, false),
  ('Contatado', '#8b5cf6', 1, false),
  ('Entrevista Agendada', '#f59e0b', 2, false),
  ('Entrevistado', '#06b6d4', 3, false),
  ('Aprovado', '#10b981', 4, false),
  ('Reprovado', '#ef4444', 5, true),
  ('Contratado', '#059669', 6, true);

CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  job_title TEXT,
  resume_url TEXT,
  notes TEXT,
  status_id UUID REFERENCES public.candidate_status(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  hired_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_candidate(_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_rh(auth.uid())
    OR EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = _candidate_id AND (c.created_by = auth.uid() OR c.owner_id = auth.uid()));
$$;

CREATE POLICY "cand view" ON public.candidates FOR SELECT TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid());
CREATE POLICY "cand insert" ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "cand update" ON public.candidates FOR UPDATE TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin_or_rh(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid());
CREATE POLICY "cand delete" ON public.candidates FOR DELETE TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.candidate_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_activities TO authenticated;
GRANT ALL ON public.candidate_activities TO service_role;
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cact view" ON public.candidate_activities FOR SELECT TO authenticated
  USING (public.can_view_candidate(candidate_id));
CREATE POLICY "cact insert" ON public.candidate_activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.can_view_candidate(candidate_id));
CREATE POLICY "cact delete" ON public.candidate_activities FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin_or_rh(auth.uid()));

CREATE TABLE public.candidate_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  interviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  outcome TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_interviews TO authenticated;
GRANT ALL ON public.candidate_interviews TO service_role;
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cint view" ON public.candidate_interviews FOR SELECT TO authenticated
  USING (public.can_view_candidate(candidate_id));
CREATE POLICY "cint insert" ON public.candidate_interviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.can_view_candidate(candidate_id));
CREATE POLICY "cint update" ON public.candidate_interviews FOR UPDATE TO authenticated
  USING (public.can_view_candidate(candidate_id))
  WITH CHECK (public.can_view_candidate(candidate_id));
CREATE POLICY "cint delete" ON public.candidate_interviews FOR DELETE TO authenticated
  USING (public.can_view_candidate(candidate_id));

CREATE TRIGGER trg_cint_updated BEFORE UPDATE ON public.candidate_interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for resumes bucket
CREATE POLICY "resumes read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes');
CREATE POLICY "resumes upload auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "resumes update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "resumes delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_interviews;

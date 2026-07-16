
-- notes table
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.notes(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sem título',
  icon text,
  cover_url text,
  content jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  is_private boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

CREATE INDEX notes_owner_idx ON public.notes(owner_id);
CREATE INDEX notes_parent_idx ON public.notes(parent_id);

-- note_shares
CREATE TABLE public.note_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  shared_with_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.share_permission NOT NULL DEFAULT 'view',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id, shared_with_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_shares TO authenticated;
GRANT ALL ON public.note_shares TO service_role;

CREATE INDEX note_shares_note_idx ON public.note_shares(note_id);
CREATE INDEX note_shares_user_idx ON public.note_shares(shared_with_id);

-- helper functions
CREATE OR REPLACE FUNCTION public.has_note_access(_note_id uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_shares
    WHERE note_id = _note_id AND shared_with_id = _viewer
  );
$$;

CREATE OR REPLACE FUNCTION public.has_note_edit(_note_id uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_shares
    WHERE note_id = _note_id AND shared_with_id = _viewer AND permission = 'edit'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_note(_note_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN EXISTS (SELECT 1 FROM public.notes n WHERE n.id = _note_id AND n.is_private) THEN
      EXISTS (SELECT 1 FROM public.notes n WHERE n.id = _note_id AND n.owner_id = auth.uid())
      OR public.has_note_access(_note_id, auth.uid())
    ELSE
      public.is_admin_or_rh(auth.uid())
      OR EXISTS (SELECT 1 FROM public.notes n WHERE n.id = _note_id AND n.owner_id = auth.uid())
      OR public.has_note_access(_note_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.notes n
        JOIN public.task_list_shares s ON s.owner_id = n.owner_id
        WHERE n.id = _note_id AND s.shared_with_id = auth.uid()
      )
    END;
$$;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner sees own notes" ON public.notes
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Shared notes visible" ON public.notes
  FOR SELECT USING (public.can_view_note(id));

CREATE POLICY "Owner inserts notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner updates notes" ON public.notes
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Editors update notes" ON public.notes
  FOR UPDATE USING (public.has_note_edit(id, auth.uid()));

CREATE POLICY "Owner deletes notes" ON public.notes
  FOR DELETE USING (auth.uid() = owner_id);

ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Note owner manages shares" ON public.note_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.owner_id = auth.uid())
  );

CREATE POLICY "Shared user reads own shares" ON public.note_shares
  FOR SELECT USING (auth.uid() = shared_with_id);

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_shares;

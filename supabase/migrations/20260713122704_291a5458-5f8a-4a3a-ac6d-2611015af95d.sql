
-- Enum de permissão
DO $$ BEGIN
  CREATE TYPE public.share_permission AS ENUM ('view','edit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de compartilhamento de lista de tarefas
CREATE TABLE public.task_list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.share_permission NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, shared_with_id),
  CHECK (owner_id <> shared_with_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_list_shares TO authenticated;
GRANT ALL ON public.task_list_shares TO service_role;

ALTER TABLE public.task_list_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own shares"
  ON public.task_list_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Shared user can view their share"
  ON public.task_list_shares FOR SELECT
  USING (auth.uid() = shared_with_id);

CREATE POLICY "Admin RH view all shares"
  ON public.task_list_shares FOR SELECT
  USING (public.is_admin_or_rh(auth.uid()));

CREATE TRIGGER trg_task_list_shares_updated
  BEFORE UPDATE ON public.task_list_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helpers
CREATE OR REPLACE FUNCTION public.has_share_access(_owner_id uuid, _viewer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_list_shares
    WHERE owner_id = _owner_id AND shared_with_id = _viewer_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_share_edit(_owner_id uuid, _viewer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_list_shares
    WHERE owner_id = _owner_id AND shared_with_id = _viewer_id AND permission = 'edit'
  );
$$;

-- Atualiza can_view_task para incluir compartilhamento
CREATE OR REPLACE FUNCTION public.can_view_task(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin_or_rh(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = _task_id AND ta.user_id = auth.uid())
    OR (
      public.has_role(auth.uid(), 'gestor')
      AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.sector_id = public.current_user_sector())
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.task_list_shares s ON s.owner_id = t.created_by
      WHERE t.id = _task_id AND s.shared_with_id = auth.uid()
    );
$$;

-- Nova política de SELECT nas tasks para incluir compartilhamento
DROP POLICY IF EXISTS "Shared users can view shared tasks" ON public.tasks;
CREATE POLICY "Shared users can view shared tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_list_shares s
      WHERE s.owner_id = tasks.created_by AND s.shared_with_id = auth.uid()
    )
  );

-- Permite INSERT como se fosse o dono (usuário com edit cria tarefas para o dono)
DROP POLICY IF EXISTS "Shared editors can insert tasks for owner" ON public.tasks;
CREATE POLICY "Shared editors can insert tasks for owner"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.has_share_edit(tasks.created_by, auth.uid())
    OR auth.uid() = tasks.created_by
  );

DROP POLICY IF EXISTS "Shared editors can update tasks" ON public.tasks;
CREATE POLICY "Shared editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.has_share_edit(tasks.created_by, auth.uid()))
  WITH CHECK (public.has_share_edit(tasks.created_by, auth.uid()));

-- Tabela de menções
CREATE TABLE public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE,
  context text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentions TO authenticated;
GRANT ALL ON public.mentions TO service_role;

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentioned user reads own mentions"
  ON public.mentions FOR SELECT
  USING (auth.uid() = mentioned_user_id OR auth.uid() = mentioned_by_id);

CREATE POLICY "User creates mentions"
  ON public.mentions FOR INSERT
  WITH CHECK (auth.uid() = mentioned_by_id);

CREATE POLICY "Mentioned user updates own mentions"
  ON public.mentions FOR UPDATE
  USING (auth.uid() = mentioned_user_id)
  WITH CHECK (auth.uid() = mentioned_user_id);

CREATE INDEX idx_mentions_user ON public.mentions(mentioned_user_id, read_at);
CREATE INDEX idx_task_list_shares_shared_with ON public.task_list_shares(shared_with_id);
CREATE INDEX idx_task_list_shares_owner ON public.task_list_shares(owner_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_list_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;

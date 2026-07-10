
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'rh', 'gestor', 'colaborador');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'normal', 'alta', 'urgente');

-- =====================================================
-- Timestamp helper
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  cargo TEXT,
  phone TEXT,
  sector_id UUID,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- USER ROLES
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_sector()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sector_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_rh(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'rh');
$$;

-- =====================================================
-- SIGNUP TRIGGER: creates profile + first user becomes admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'colaborador';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins/RH can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin_or_rh(auth.uid()));
CREATE POLICY "Admins/RH can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_rh(auth.uid()));
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles RLS
CREATE POLICY "Authenticated can read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- SECTORS
-- =====================================================
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#22c55e',
  icon TEXT NOT NULL DEFAULT 'Briefcase',
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sectors_updated BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ADD CONSTRAINT profiles_sector_fk
  FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;

CREATE POLICY "Read sectors" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sectors" ON public.sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- CATEGORIES
-- =====================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#22c55e',
  icon TEXT NOT NULL DEFAULT 'Tag',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- TASK STATUSES
-- =====================================================
CREATE TABLE public.task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  position INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_statuses TO authenticated;
GRANT ALL ON public.task_statuses TO service_role;
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read statuses" ON public.task_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage statuses" ON public.task_statuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- TASKS
-- =====================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.task_statuses(id) ON DELETE SET NULL,
  priority public.task_priority NOT NULL DEFAULT 'normal',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE,
  due_time TIME,
  estimated_minutes INTEGER,
  spent_minutes INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_tasks_status ON public.tasks(status_id);
CREATE INDEX idx_tasks_sector ON public.tasks(sector_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);

-- Task assignees
CREATE TABLE public.task_assignees (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Visibility helper
CREATE OR REPLACE FUNCTION public.can_view_task(_task_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_rh(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = _task_id AND ta.user_id = auth.uid())
    OR (
      public.has_role(auth.uid(), 'gestor')
      AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.sector_id = public.current_user_sector())
    );
$$;

-- Tasks RLS
CREATE POLICY "View permitted tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.can_view_task(id));
CREATE POLICY "Create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Update permitted tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (public.can_view_task(id));
CREATE POLICY "Delete own or admin" ON public.tasks
  FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin_or_rh(auth.uid()));

CREATE POLICY "View assignees for visible tasks" ON public.task_assignees
  FOR SELECT TO authenticated USING (public.can_view_task(task_id));
CREATE POLICY "Manage assignees for permitted tasks" ON public.task_assignees
  FOR ALL TO authenticated
  USING (public.can_view_task(task_id))
  WITH CHECK (public.can_view_task(task_id));

-- =====================================================
-- CHECKLISTS
-- =====================================================
CREATE TABLE public.task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Checklist',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklists TO authenticated;
GRANT ALL ON public.task_checklists TO service_role;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checklist visible" ON public.task_checklists FOR SELECT TO authenticated USING (public.can_view_task(task_id));
CREATE POLICY "Checklist manage" ON public.task_checklists FOR ALL TO authenticated
  USING (public.can_view_task(task_id)) WITH CHECK (public.can_view_task(task_id));

CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.task_checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items visible" ON public.checklist_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.task_checklists c WHERE c.id = checklist_id AND public.can_view_task(c.task_id))
);
CREATE POLICY "Items manage" ON public.checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_checklists c WHERE c.id = checklist_id AND public.can_view_task(c.task_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.task_checklists c WHERE c.id = checklist_id AND public.can_view_task(c.task_id)));

-- =====================================================
-- COMMENTS
-- =====================================================
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments visible" ON public.task_comments FOR SELECT TO authenticated USING (public.can_view_task(task_id));
CREATE POLICY "Comments insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_task(task_id));
CREATE POLICY "Comments update own" ON public.task_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Comments delete own or admin" ON public.task_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_rh(auth.uid()));

-- =====================================================
-- ATTACHMENTS
-- =====================================================
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attach visible" ON public.task_attachments FOR SELECT TO authenticated USING (public.can_view_task(task_id));
CREATE POLICY "Attach insert" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_task(task_id));
CREATE POLICY "Attach delete own or admin" ON public.task_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_rh(auth.uid()));

-- =====================================================
-- TASK FAVORITES
-- =====================================================
CREATE TABLE public.task_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_favorites TO authenticated;
GRANT ALL ON public.task_favorites TO service_role;
ALTER TABLE public.task_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites" ON public.task_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- CALENDAR EVENTS
-- =====================================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#22c55e',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_attendees (
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendees TO authenticated;
GRANT ALL ON public.event_attendees TO service_role;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_event(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_rh(auth.uid())
    OR EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = _event_id AND e.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = _event_id AND ea.user_id = auth.uid())
    OR (
      public.has_role(auth.uid(), 'gestor')
      AND EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = _event_id AND e.sector_id = public.current_user_sector())
    );
$$;

CREATE POLICY "Events view" ON public.calendar_events FOR SELECT TO authenticated USING (public.can_view_event(id));
CREATE POLICY "Events insert" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Events update" ON public.calendar_events FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_rh(auth.uid()));
CREATE POLICY "Events delete" ON public.calendar_events FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Attendees view" ON public.event_attendees FOR SELECT TO authenticated USING (public.can_view_event(event_id));
CREATE POLICY "Attendees manage" ON public.event_attendees FOR ALL TO authenticated
  USING (public.can_view_event(event_id)) WITH CHECK (public.can_view_event(event_id));

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_user ON public.notifications(user_id, read);
CREATE POLICY "Own notifications view" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View logs admin/rh" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- SEED DEFAULTS
-- =====================================================
INSERT INTO public.task_statuses (name, color, position, is_done) VALUES
  ('Pendente', '#94a3b8', 0, false),
  ('Em andamento', '#3b82f6', 1, false),
  ('Aguardando aprovação', '#f59e0b', 2, false),
  ('Em análise', '#8b5cf6', 3, false),
  ('Concluído', '#22c55e', 4, true),
  ('Cancelado', '#ef4444', 5, false);

INSERT INTO public.categories (name, color, icon) VALUES
  ('RH', '#ec4899', 'Users'),
  ('Financeiro', '#22c55e', 'DollarSign'),
  ('Marketing', '#f59e0b', 'Megaphone'),
  ('Compras', '#8b5cf6', 'ShoppingCart'),
  ('Paisagismo', '#84cc16', 'Trees'),
  ('Irrigação', '#06b6d4', 'Droplets'),
  ('Administrativo', '#64748b', 'FileText'),
  ('Obras', '#f97316', 'HardHat'),
  ('Facilities', '#0ea5e9', 'Wrench'),
  ('TI', '#6366f1', 'Cpu');

INSERT INTO public.sectors (name, color, icon) VALUES
  ('RH', '#ec4899', 'Users'),
  ('Financeiro', '#22c55e', 'DollarSign'),
  ('Marketing', '#f59e0b', 'Megaphone'),
  ('Operacional', '#64748b', 'Settings'),
  ('Paisagismo', '#84cc16', 'Trees'),
  ('Irrigação', '#06b6d4', 'Droplets'),
  ('Obras', '#f97316', 'HardHat'),
  ('Comercial', '#8b5cf6', 'Handshake'),
  ('Facilities', '#0ea5e9', 'Wrench'),
  ('Administrativo', '#334155', 'FileText');

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

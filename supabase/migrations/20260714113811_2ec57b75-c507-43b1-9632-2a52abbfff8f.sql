
CREATE POLICY "Own tasks visible" ON public.tasks
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Assignee tasks visible" ON public.tasks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()));

DROP FUNCTION IF EXISTS public.whoami();

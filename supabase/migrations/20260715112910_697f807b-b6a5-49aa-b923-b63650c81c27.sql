
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_view_task(_task_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Private tasks: only creator or explicitly assigned users
    CASE WHEN EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.is_private) THEN
      EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = _task_id AND ta.user_id = auth.uid())
    ELSE
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
      )
    END;
$function$;

-- Update assignee visibility policy to skip private-except-assignee (already handled by can_view_task via other policies, but the sibling policy "Assignee tasks visible" is fine — assignees always see). 
-- The direct "Own tasks visible" policy is fine (creator sees own).
-- Nothing else to change here since RLS uses OR of policies; can_view_task now excludes shares for private.

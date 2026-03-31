
DROP POLICY "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      has_role(auth.uid(), 'company_admin'::app_role)
      AND organization_id = get_user_org(auth.uid())
      AND role <> 'super_admin'::app_role
    )
  );

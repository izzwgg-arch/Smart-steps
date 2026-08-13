-- Fix 1: admin@apluscenter.local was misclassified as RBT; make it a real Admin
-- (matches the appRoleId already used by the other two correct admin accounts).
update "User"
set role = 'ADMIN', "appRoleId" = 'cmr8bmaf80049kq7lehe6yq55'
where email = 'admin@apluscenter.local';

-- Fix 2: apluscenter1@gmail.com was created via the new local-password Staff
-- flow but never got an appRoleId assigned (the bug just fixed in code).
-- Backfill it to match its existing legacy role (RBT) so it's not stuck at
-- zero permissions; can be changed via Roles & Permissions afterward.
update "User"
set "appRoleId" = 'cmr8bmadp0022kq7lrgfwhpid'
where email = 'apluscenter1@gmail.com' and "appRoleId" is null;

select email, role, "appRoleId" from "User" where email in ('admin@apluscenter.local', 'apluscenter1@gmail.com');

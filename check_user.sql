select id, email, role, "appRoleId", "isActive", "passwordHash" is not null as has_password
from "User" where email = 'admin@apluscenter.local';

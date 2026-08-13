select u.id, u.email, u.role, u."appRoleId", ar.key as approle_key, u."isActive", (u."passwordHash" is not null) as has_pw
from "User" u
left join "AppRole" ar on ar.id = u."appRoleId"
order by u."createdAt" asc
limit 30;

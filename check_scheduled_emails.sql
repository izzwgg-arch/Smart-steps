SELECT 
  id, 
  status, 
  "scheduledSendAt", 
  "sentAt", 
  "errorMessage",
  "toEmail"
FROM "EmailQueueItem" 
WHERE "scheduledSendAt" IS NOT NULL 
ORDER BY "scheduledSendAt" DESC 
LIMIT 10;

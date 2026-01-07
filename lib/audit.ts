import { prisma } from './prisma'
import { AuditAction } from '@prisma/client'

/**
 * Audit logging utility
 * Logs all critical actions in the system for compliance and tracking
 */

export interface AuditLogData {
  action: AuditAction
  entity: string // Model name (e.g., 'User', 'Timesheet', 'Invoice')
  entityId: string
  userId: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        userId: data.userId,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
      },
    })
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Log a CREATE action
 */
export async function logCreate(
  entity: string,
  entityId: string,
  userId: string,
  newValues: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'CREATE',
    entity,
    entityId,
    userId,
    newValues,
  })
}

/**
 * Log an UPDATE action
 */
export async function logUpdate(
  entity: string,
  entityId: string,
  userId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'UPDATE',
    entity,
    entityId,
    userId,
    oldValues,
    newValues,
  })
}

/**
 * Log a DELETE action
 */
export async function logDelete(
  entity: string,
  entityId: string,
  userId: string,
  oldValues: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'DELETE',
    entity,
    entityId,
    userId,
    oldValues,
  })
}

/**
 * Log an APPROVE action
 */
export async function logApprove(
  entity: string,
  entityId: string,
  userId: string,
  details?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'APPROVE',
    entity,
    entityId,
    userId,
    newValues: details,
  })
}

/**
 * Log a REJECT action
 */
export async function logReject(
  entity: string,
  entityId: string,
  userId: string,
  reason?: string
): Promise<void> {
  await createAuditLog({
    action: 'REJECT',
    entity,
    entityId,
    userId,
    newValues: reason ? { reason } : undefined,
  })
}

/**
 * Log a SUBMIT action
 */
export async function logSubmit(
  entity: string,
  entityId: string,
  userId: string
): Promise<void> {
  await createAuditLog({
    action: 'SUBMIT',
    entity,
    entityId,
    userId,
  })
}

/**
 * Log a LOCK action
 */
export async function logLock(
  entity: string,
  entityId: string,
  userId: string
): Promise<void> {
  await createAuditLog({
    action: 'LOCK',
    entity,
    entityId,
    userId,
  })
}

/**
 * Log a GENERATE action (e.g., invoice generation)
 */
export async function logGenerate(
  entity: string,
  entityId: string,
  userId: string,
  details?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'GENERATE',
    entity,
    entityId,
    userId,
    newValues: details,
  })
}

/**
 * Log a PAYMENT action
 */
export async function logPayment(
  entity: string,
  entityId: string,
  userId: string,
  paymentDetails: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'PAYMENT',
    entity,
    entityId,
    userId,
    newValues: paymentDetails,
  })
}

/**
 * Log an ADJUSTMENT action
 */
export async function logAdjustment(
  entity: string,
  entityId: string,
  userId: string,
  adjustmentDetails: Record<string, any>
): Promise<void> {
  await createAuditLog({
    action: 'ADJUSTMENT',
    entity,
    entityId,
    userId,
    newValues: adjustmentDetails,
  })
}

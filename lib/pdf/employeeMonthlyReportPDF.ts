/**
 * PDF Generator for Employee Monthly Payroll Reports
 * Uses Playwright to convert HTML to PDF
 */

import type { EmployeeMonthlyReportPayload } from '@/lib/payroll/employeeMonthlyReportBuilder'
import { generateEmployeeMonthlyReportHTML } from './payrollEmployeeMonthlyReportHtml'
import { generatePDFFromHTML } from './playwrightPDF'

export async function generateEmployeeMonthlyReportPDF(
  data: EmployeeMonthlyReportPayload
): Promise<Buffer> {
  const html = generateEmployeeMonthlyReportHTML(data)
  return await generatePDFFromHTML(html)
}

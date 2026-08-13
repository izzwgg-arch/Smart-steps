/**
 * Playwright PDF Generation
 *
 * Provides a resilient singleton browser instance for PDF generation.
 * Handles browser crashes by resetting the singleton and retrying.
 * Reuses browser to avoid slow startup, but re-initializes automatically on failure.
 */

import { chromium, Browser } from 'playwright'
import { randomBytes } from 'crypto'

// Global browser instance (singleton)
let browserInstance: Browser | null = null
let browserPromise: Promise<Browser> | null = null

// Errors that indicate the browser is gone and we should reset + retry
const BROWSER_CRASH_PATTERNS = [
  'Target closed',
  'Browser closed',
  'disconnected',
  'Connection closed',
  'Page crashed',
  'Protocol error',
]

function isBrowserCrashError(error: any): boolean {
  const msg = String(error?.message || '')
  return BROWSER_CRASH_PATTERNS.some(p => msg.includes(p))
}

/**
 * Get or create a shared browser instance.
 * On launch failure the promise is reset so subsequent calls can retry.
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance
  }

  if (browserPromise) {
    return browserPromise
  }

  browserPromise = (async () => {
    console.log('[PLAYWRIGHT_PDF] Launching Chromium browser...')
    let browser: Browser

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',  // Avoids /dev/shm exhaustion on Linux
          '--disable-gpu',
        ],
      })
    } catch (launchError: any) {
      // Reset promise so the next caller can attempt a fresh launch
      console.error('[PLAYWRIGHT_PDF] Browser launch failed, resetting singleton:', launchError?.message)
      browserPromise = null
      throw launchError
    }

    console.log('[PLAYWRIGHT_PDF] Browser launched successfully')

    browser.on('disconnected', () => {
      console.log('[PLAYWRIGHT_PDF] Browser disconnected, resetting singleton')
      browserInstance = null
      browserPromise = null
    })

    browserInstance = browser

    // Graceful shutdown hooks (register only once)
    const cleanup = async () => {
      if (browserInstance) {
        try { await browserInstance.close() } catch (_) {}
        browserInstance = null
        browserPromise = null
      }
    }
    process.once('SIGTERM', cleanup)
    process.once('SIGINT', cleanup)

    return browser
  })()

  return browserPromise
}

/**
 * Generate PDF from an HTML string using Playwright.
 *
 * Retries once with a fresh browser if the first attempt fails with a
 * browser-crash error — this handles stale singleton state after batch
 * creation or server activity that causes the browser to disconnect.
 *
 * @param html          HTML content to render
 * @param correlationId Optional ID for log tracing
 */
export async function generatePDFFromHTML(
  html: string,
  correlationId?: string
): Promise<Buffer> {
  const corrId = correlationId || `pdf-${Date.now()}-${randomBytes(4).toString('hex')}`
  const startTime = Date.now()

  console.log(`[PLAYWRIGHT_PDF] ${corrId} Starting PDF generation`)

  const attemptGenerate = async (): Promise<Buffer> => {
    const browser = await getBrowser()
    const page = await browser.newPage()

    try {
      await page.setContent(html, { waitUntil: 'load' })

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
          right: '0.5in',
        },
      })

      const duration = Date.now() - startTime
      console.log(`[PLAYWRIGHT_PDF] ${corrId} PDF generated successfully`, {
        bytes: pdfBuffer.length,
        duration: `${duration}ms`,
      })

      return Buffer.from(pdfBuffer)
    } finally {
      try { await page.close() } catch (_) {}
    }
  }

  // First attempt
  try {
    return await attemptGenerate()
  } catch (error: any) {
    if (isBrowserCrashError(error)) {
      console.warn(`[PLAYWRIGHT_PDF] ${corrId} Browser crash detected on first attempt — resetting and retrying`, {
        error: error?.message,
      })

      // Force-reset singleton so getBrowser() will launch a fresh one
      await closeBrowser()

      // Second attempt with a fresh browser
      try {
        return await attemptGenerate()
      } catch (retryError: any) {
        console.error(`[PLAYWRIGHT_PDF] ${corrId} PDF generation failed after retry`, {
          error: retryError?.message,
          stack: retryError?.stack,
        })
        throw retryError
      }
    }

    console.error(`[PLAYWRIGHT_PDF] ${corrId} PDF generation failed`, {
      error: error?.message,
      stack: error?.stack,
    })
    throw error
  }
}

/**
 * Close the shared browser instance (used for cleanup or forced reset).
 */
export async function closeBrowser(): Promise<void> {
  const instance = browserInstance
  browserInstance = null
  browserPromise = null

  if (instance) {
    console.log('[PLAYWRIGHT_PDF] Closing browser instance')
    try { await instance.close() } catch (_) {}
  }
}

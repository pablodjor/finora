const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'

export function hasGemini() {
  return Boolean(GEMINI_KEY)
}

export function getGeminiModel() {
  return GEMINI_MODEL
}

/**
 * Llama a Gemini generateContent con la misma forma que el curl de AI Studio:
 * modelo gemini-flash-latest + header X-goog-api-key.
 */
export async function geminiGenerateContent({
  parts,
  temperature = 0.3,
  responseMimeType,
  timeoutMs = 25000,
} = {}) {
  if (!GEMINI_KEY) throw new Error('Falta VITE_GEMINI_API_KEY')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const body = {
      contents: [{ parts }],
      generationConfig: {
        temperature,
      },
    }
    if (responseMimeType) {
      body.generationConfig.responseMimeType = responseMimeType
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_KEY,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })

    const raw = await response.text()
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          'Gemini sin cuota por ahora (límite agotado). Probá de nuevo en un rato.',
        )
      }
      throw new Error(`Gemini falló (${response.status}): ${raw.slice(0, 220)}`)
    }

    const data = JSON.parse(raw)
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join('') || ''

    if (!text) {
      throw new Error('Gemini no devolvió texto')
    }

    return { text, raw: data }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Gemini tardó demasiado. Intentá de nuevo.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

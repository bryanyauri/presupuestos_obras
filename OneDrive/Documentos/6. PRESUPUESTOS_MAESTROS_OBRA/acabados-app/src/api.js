const request = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    },
    credentials: 'same-origin'
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'No se pudo completar la solicitud.')
  }

  return response
}

export const getJson = async (path) => (await request(path)).json()

export const postJson = async (path, payload) => (await request(path, {
  method: 'POST',
  body: JSON.stringify(payload)
})).json()

export const postForBlob = async (path, payload) => {
  const response = await request(path, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

  return {
    blob: await response.blob(),
    remaining: Number(response.headers.get('X-Quotes-Remaining')),
    filename: response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'cotizacion.pdf'
  }
}
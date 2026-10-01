/**
 * Chart screenshots live in IndexedDB rather than localStorage: a few images
 * would fill localStorage's ~5 MB quota, while IndexedDB holds hundreds of MB.
 * Day notes keep only the image ids.
 */

const DB = 'trading-journal-images'
const STORE = 'images'
const MAX_SIDE = 1920

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close()) as Promise<T>
}

export const getImage = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const putImage = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const deleteImage = (id: string) => tx('readwrite', (s) => s.delete(id))
export const clearImages = () => tx('readwrite', (s) => s.clear())

/** Shrinks large screenshots so a month of charts stays in the tens of MB, then stores it. */
export async function saveScreenshot(file: Blob): Promise<string> {
  const id = `img-${crypto.randomUUID()}`
  await putImage(id, await shrink(file))
  return id
}

async function shrink(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1_500_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
    return out && out.size < file.size ? out : file
  } catch {
    return file
  }
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export const dataUrlToBlob = async (url: string) => (await fetch(url)).blob()

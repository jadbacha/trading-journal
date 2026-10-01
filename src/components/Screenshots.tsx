import { useEffect, useState } from 'react'
import { getImage } from '../images'

interface Props {
  ids: string[]
  busy: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}

/** Loads stored screenshots as object URLs and frees them when the list changes. */
function useImageUrls(ids: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = ids.join('|')
  useEffect(() => {
    let cancelled = false
    const made: string[] = []
    Promise.all(
      ids.map(async (id) => {
        const blob = await getImage(id).catch(() => undefined)
        if (!blob) return [id, ''] as const
        const url = URL.createObjectURL(blob)
        made.push(url)
        return [id, url] as const
      }),
    ).then((pairs) => {
      if (!cancelled) setUrls(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
      made.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `ids`
  }, [key])
  return urls
}

export function Screenshots({ ids, busy, onAdd, onRemove }: Props) {
  const urls = useImageUrls(ids)
  const [open, setOpen] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className={`shots ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        onAdd([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')))
      }}
    >
      {ids.length > 0 && (
        <div className="shot-grid">
          {ids.map((id) => (
            <div key={id} className="shot">
              {urls[id] ? (
                <button className="shot-open" onClick={() => setOpen(id)} aria-label="View screenshot">
                  <img src={urls[id]} alt="Chart screenshot" />
                </button>
              ) : (
                <span className="shot-missing">{id in urls ? 'Missing' : '…'}</span>
              )}
              <button className="icon-btn small shot-remove" onClick={() => onRemove(id)} aria-label="Remove screenshot">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="shot-add">
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onAdd([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        {busy ? 'Saving…' : '+ Screenshot: paste (⌘V), drop, or click'}
      </label>

      {open && urls[open] && (
        <div className="modal-backdrop lightbox" onClick={() => setOpen(null)}>
          <img src={urls[open]} alt="Chart screenshot, full size" />
        </div>
      )}
    </div>
  )
}

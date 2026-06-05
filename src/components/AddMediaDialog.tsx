'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/use-toast'

interface AddMediaDialogProps {
  onAdded: () => void
}

export function AddMediaDialog({ onAdded }: AddMediaDialogProps) {
  const { addDialogOpen, setAddDialogOpen } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'MOVIE',
    genre: '',
    videoUrl: '',
    thumbnail: '',
    duration: '',
    releaseYear: '2024',
    artist: '',
    channel: '',
  })

  const handleClose = (open: boolean) => {
    setAddDialogOpen(open)
    if (!open) {
      setForm({
        title: '',
        description: '',
        type: 'MOVIE',
        genre: '',
        videoUrl: '',
        thumbnail: '',
        duration: '',
        releaseYear: '2024',
        artist: '',
        channel: '',
      })
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.videoUrl) {
      toast({ title: 'Title and Video URL are required', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          releaseYear: parseInt(form.releaseYear) || 2024,
        }),
      })

      if (!res.ok) throw new Error('Failed to add media')

      toast({ title: 'Media added successfully!' })
      handleClose(false)
      onAdded()
    } catch (err) {
      toast({ title: 'Failed to add media', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={addDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Add New Media
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Enter media title"
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOVIE">🎬 Movie</SelectItem>
                  <SelectItem value="TV_SHOW">📺 TV Show</SelectItem>
                  <SelectItem value="MUSIC">🎵 Music</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="genre">Genre</Label>
              <Input
                id="genre"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                placeholder="Action, Comedy, etc."
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="videoUrl">Video URL *</Label>
              <Input
                id="videoUrl"
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                placeholder="https://example.com/video.mp4"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="thumbnail">Thumbnail URL</Label>
              <Input
                id="thumbnail"
                value={form.thumbnail}
                onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                placeholder="https://example.com/thumbnail.jpg"
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="3:45"
              />
            </div>

            <div>
              <Label htmlFor="releaseYear">Year</Label>
              <Input
                id="releaseYear"
                type="number"
                value={form.releaseYear}
                onChange={(e) => setForm({ ...form, releaseYear: e.target.value })}
                placeholder="2024"
              />
            </div>

            <div>
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={form.artist}
                onChange={(e) => setForm({ ...form, artist: e.target.value })}
                placeholder="Artist name"
              />
            </div>

            <div>
              <Label htmlFor="channel">Channel</Label>
              <Input
                id="channel"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                placeholder="Channel name"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe this media..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Add Media
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

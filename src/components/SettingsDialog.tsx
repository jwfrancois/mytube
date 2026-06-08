'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Server,
  Link2,
  User,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/use-toast'

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen, jellyfinConnected, setJellyfinConnected, jellyfinServer, setJellyfinServer } = useAppStore()
  const [serverUrl, setServerUrl] = useState('https://manitou.dyabavadra.com')
  const [username, setUsername] = useState('dyabavadra')
  const [password, setPassword] = useState('bonjour66')
  const [connecting, setConnecting] = useState(false)
  const [serverInfo, setServerInfo] = useState<{ serverName: string; version: string; operatingSystem: string } | null>(null)

  // Check connection status on open
  useEffect(() => {
    if (settingsOpen) {
      checkJellyfinStatus()
    }
  }, [settingsOpen])

  const checkJellyfinStatus = async () => {
    try {
      const res = await fetch('/api/jellyfin/status')
      const data = await res.json()
      setJellyfinConnected(data.connected)
      setJellyfinServer(data.server)
      if (data.serverInfo) {
        setServerInfo(data.serverInfo)
      } else {
        setServerInfo(null)
      }
      if (data.server) {
        setServerUrl(data.server.serverUrl)
        setUsername(data.server.username)
      }
    } catch {
      setJellyfinConnected(false)
    }
  }

  const handleConnect = async () => {
    if (!serverUrl || !username || !password) {
      toast({ title: 'All fields are required', variant: 'destructive' })
      return
    }

    setConnecting(true)
    try {
      const res = await fetch('/api/jellyfin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: data.error || 'Connection failed', variant: 'destructive' })
        return
      }

      setJellyfinConnected(true)
      setJellyfinServer(data.server)
      toast({ title: 'Connected to Jellyfin!', description: `${data.server.serverUrl}` })
      checkJellyfinStatus()
    } catch (err) {
      toast({ title: 'Connection failed', description: 'Could not reach the server', variant: 'destructive' })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await fetch('/api/jellyfin/disconnect', { method: 'DELETE' })
      setJellyfinConnected(false)
      setJellyfinServer(null)
      setServerInfo(null)
      toast({ title: 'Disconnected from Jellyfin' })
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ─── NAS / Jellyfin Section ──────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Jellyfin NAS Server</h3>
                {jellyfinConnected ? (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
                    <XCircle className="h-3 w-3" />
                    Disconnected
                  </Badge>
                )}
              </div>
            </div>

            {jellyfinConnected && serverInfo && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Server:</span>
                  <span className="font-medium">{serverInfo.serverName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Version:</span>
                  <span>{serverInfo.version}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">OS:</span>
                  <span>{serverInfo.operatingSystem}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">User:</span>
                  <span>{jellyfinServer?.username}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="serverUrl" className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Server URL
                </Label>
                <Input
                  id="serverUrl"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://your-jellyfin-server.com"
                  disabled={jellyfinConnected}
                />
              </div>

              <div>
                <Label htmlFor="jellyfinUser" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Username
                </Label>
                <Input
                  id="jellyfinUser"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your Jellyfin username"
                  disabled={jellyfinConnected}
                />
              </div>

              <div>
                <Label htmlFor="jellyfinPwd" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Password
                </Label>
                <Input
                  id="jellyfinPwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your Jellyfin password"
                  disabled={jellyfinConnected}
                />
              </div>
            </div>

            {jellyfinConnected ? (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkJellyfinStatus}
                  className="gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full mt-4 gap-1"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Server className="h-4 w-4" />
                )}
                {connecting ? 'Connecting...' : 'Connect to Jellyfin'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

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
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Radio,
  Wifi,
  Cpu,
  Tv2,
  Scan,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/use-toast'
import { getHDHomerunIp, discoverHDHomerun, fetchHDHomerunLineup, setHDHomerunIp } from '@/lib/hdhomerun-client'

interface HDHomerunTuner {
  id: string
  name: string
  tunerIp: string
  tunerCount: number
  model: string
  firmware: string
  deviceId: string
  connected: boolean
  lastConnected: string | null
}

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen, jellyfinConnected, setJellyfinConnected, jellyfinServer, setJellyfinServer, setHdhrConnected, setHdhrTunerIp: setStoreHdhrTunerIp } = useAppStore()
  const [serverUrl, setServerUrl] = useState('https://manitou.dyabavadra.com')
  const [username, setUsername] = useState('dyabavadra')
  const [password, setPassword] = useState('bonjour66')
  const [connecting, setConnecting] = useState(false)
  const [serverInfo, setServerInfo] = useState<{ serverName: string; version: string; operatingSystem: string } | null>(null)

  // HDHomerun state
  const [hdhrTunerIp, setHdhrTunerIp] = useState('')
  const [hdhrConnecting, setHdhrConnecting] = useState(false)
  const [hdhrTuners, setHdhrTuners] = useState<HDHomerunTuner[]>([])
  const [hdhrScanning, setHdhrScanning] = useState(false)
  const [hdhrChannelCount, setHdhrChannelCount] = useState<number | null>(null)

  // Check connection status on open
  useEffect(() => {
    if (settingsOpen) {
      checkJellyfinStatus()
      fetchHDHomerunTuners()
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

  // ─── HDHomerun Functions ──────────────────────────────────────────────

  const fetchHDHomerunTuners = async () => {
    try {
      const res = await fetch('/api/hdhomerun/discover')
      if (res.ok) {
        const data = await res.json()
        setHdhrTuners(data.tuners || [])
      }
    } catch {
      // Silently fail
    }
  }

  const handleHDHRConnect = async () => {
    if (!hdhrTunerIp) {
      toast({ title: 'IP address is required', variant: 'destructive' })
      return
    }

    setHdhrConnecting(true)
    try {
      // Step 1: Try client-side discovery first (browser can reach local network)
      const deviceInfo = await discoverHDHomerun(hdhrTunerIp)
      if (deviceInfo) {
        // Client-side discovery succeeded — save the IP and mark as connected
        setHDHomerunIp(hdhrTunerIp)
        setHdhrConnected(true)
        setStoreHdhrTunerIp(hdhrTunerIp)
        
        // Also try server-side registration (best effort)
        fetch('/api/hdhomerun/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tunerIp: hdhrTunerIp }),
        }).catch(() => {}) // Non-critical — server may not be able to reach the device

        toast({
          title: 'HDHomerun Connected!',
          description: `${deviceInfo.ModelName || deviceInfo.Model || 'HDHomeRun'} at ${hdhrTunerIp} (${deviceInfo.TunerCount || 2} tuners)`,
        })

        // Refresh tuner list and check channels
        await fetchHDHomerunTuners()
        // Fetch channel count client-side
        const channels = await fetchHDHomerunLineup(hdhrTunerIp)
        setHdhrChannelCount(channels.length)
        return
      }

      // Step 2: Client-side failed, try server-side as fallback
      const res = await fetch('/api/hdhomerun/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tunerIp: hdhrTunerIp }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: 'HDHomerun Connection Failed',
          description: data.error || 'Could not connect to the tuner. Make sure the IP is correct and the device is on the same network.',
          variant: 'destructive',
        })
        return
      }

      setHdhrConnected(true)
      setStoreHdhrTunerIp(hdhrTunerIp)
      setHDHomerunIp(hdhrTunerIp)

      toast({
        title: 'HDHomerun Connected!',
        description: `${data.tuner.name} at ${data.tuner.tunerIp} (${data.tuner.tunerCount} tuners)`,
      })

      // Refresh tuner list and check channels
      await fetchHDHomerunTuners()
      await fetchHDHRChannelCount(data.tuner.id)
    } catch {
      toast({
        title: 'Connection failed',
        description: 'Could not reach the HDHomerun device. Make sure the IP is correct and you are on the same network.',
        variant: 'destructive',
      })
    } finally {
      setHdhrConnecting(false)
    }
  }

  const handleHDHRDisconnect = async (tunerId: string) => {
    try {
      await fetch(`/api/hdhomerun/disconnect?id=${tunerId}`, { method: 'DELETE' })
      setHdhrTuners(prev => prev.filter(t => t.id !== tunerId))
      setHdhrChannelCount(null)
      toast({ title: 'HDHomerun tuner disconnected' })
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' })
    }
  }

  const fetchHDHRChannelCount = async (tunerId?: string) => {
    setHdhrScanning(true)
    try {
      const params = tunerId ? `?tunerId=${tunerId}` : ''
      const res = await fetch(`/api/hdhomerun/channels${params}`)
      if (res.ok) {
        const data = await res.json()
        setHdhrChannelCount(data.total || 0)
      }
    } catch {
      // Silently fail
    } finally {
      setHdhrScanning(false)
    }
  }

  const connectedTuner = hdhrTuners.find(t => t.connected)

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

          <Separator />

          {/* ─── HDHomerun Tuner Section ────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">HDHomerun Live TV Tuner</h3>
                {connectedTuner ? (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
                    <XCircle className="h-3 w-3" />
                    No Tuner
                  </Badge>
                )}
              </div>
            </div>

            {/* Info about HDHomerun */}
            <div className="bg-muted/30 rounded-lg p-3 mb-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <Radio className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <div>
                  <p className="font-medium text-foreground text-xs mb-1">Over-the-Air Live TV</p>
                  <p>Connect an HDHomerun network tuner on your local network to watch free over-the-air broadcast channels (ABC, CBS, NBC, FOX, PBS, and more).</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Wifi className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                <div>
                  <p className="font-medium text-foreground text-xs mb-1">Network Requirements</p>
                  <p>The HDHomerun must be on the same network as this server. Enter the tuner&apos;s IP address to connect.</p>
                </div>
              </div>
            </div>

            {/* Connected tuner info */}
            {connectedTuner && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Tv2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Device:</span>
                  <span className="font-medium">{connectedTuner.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">IP:</span>
                  <span>{connectedTuner.tunerIp}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Tuners:</span>
                  <span>{connectedTuner.tunerCount}</span>
                </div>
                {connectedTuner.model && (
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Model:</span>
                    <span>{connectedTuner.model}</span>
                  </div>
                )}
                {connectedTuner.firmware && (
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Firmware:</span>
                    <span>{connectedTuner.firmware}</span>
                  </div>
                )}
                {hdhrChannelCount !== null && (
                  <div className="flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Channels:</span>
                    <Badge variant="secondary" className="text-xs">{hdhrChannelCount} channels</Badge>
                  </div>
                )}
              </div>
            )}

            {!connectedTuner ? (
              /* Connection form */
              <div className="space-y-3">
                <div>
                  <Label htmlFor="hdhrIp" className="flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5" />
                    Tuner IP Address
                  </Label>
                  <Input
                    id="hdhrIp"
                    value={hdhrTunerIp}
                    onChange={(e) => setHdhrTunerIp(e.target.value)}
                    placeholder="192.168.1.100"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleHDHRConnect()
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Find the IP in your HDHomerun app or router&apos;s DHCP client list
                  </p>
                </div>

                <Button
                  onClick={handleHDHRConnect}
                  disabled={hdhrConnecting || !hdhrTunerIp}
                  className="w-full gap-1"
                >
                  {hdhrConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scan className="h-4 w-4" />
                  )}
                  {hdhrConnecting ? 'Connecting...' : 'Connect to HDHomerun'}
                </Button>
              </div>
            ) : (
              /* Connected actions */
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchHDHRChannelCount(connectedTuner.id)}
                  disabled={hdhrScanning}
                  className="gap-1"
                >
                  {hdhrScanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Scan Channels
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleHDHRDisconnect(connectedTuner.id)}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            )}

            {/* Disconnected tuners list */}
            {hdhrTuners.filter(t => !t.connected).length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Previously connected tuners:</p>
                <div className="space-y-2">
                  {hdhrTuners.filter(t => !t.connected).map(tuner => (
                    <div
                      key={tuner.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium">{tuner.name}</p>
                          <p className="text-[10px] text-muted-foreground">{tuner.tunerIp}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setHdhrTunerIp(tuner.tunerIp)
                          // Reconnect
                          fetch('/api/hdhomerun/discover', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tunerIp: tuner.tunerIp }),
                          }).then(() => fetchHDHomerunTuners())
                        }}
                      >
                        Reconnect
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

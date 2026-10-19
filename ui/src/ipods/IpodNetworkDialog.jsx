import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from 'react-admin'
import ForceGraph2D from 'react-force-graph-2d'
import {
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import { alpha, makeStyles, useTheme } from '@material-ui/core/styles'
import { MdZoomOutMap } from 'react-icons/md'
import { DialogTitle } from '../dialogs/DialogTitle'
import { DialogContent } from '../dialogs/DialogContent'
import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'
import { IpodIcon } from './IpodIcon'
import { useBrowseIpod } from './useBrowseIpod'
import { DownloadIpodButton } from './DownloadIpodButton'
import { uniqueArtists } from './artistKey'
import { TasteBadge } from './TasteBadge'
import { tasteLabelOf } from './taste'
import { FREE_SPIRITS, tribeColor } from './tribes'

const GRAPH_HEIGHT = 520
const FOCUS_MS = 800
const FIT_MS = 600
const DIMMED_ALPHA = 0.15

const useStyles = makeStyles((theme) => ({
  button: { color: 'inherit' },
  content: { minHeight: GRAPH_HEIGHT + 60 },
  networkLayout: {
    display: 'flex',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { flexDirection: 'column' },
  },
  graph: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  side: {
    width: 280,
    flexShrink: 0,
    [theme.breakpoints.down('sm')]: { width: '100%' },
  },
  search: { marginBottom: theme.spacing(2) },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
  dot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginRight: theme.spacing(0.75),
    verticalAlign: 'middle',
  },
  tribeLink: { cursor: 'pointer', marginTop: theme.spacing(1) },
  tasteLine: { marginTop: theme.spacing(1) },
  resetView: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
    backgroundColor: alpha(theme.palette.background.paper, 0.8),
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
  matchForm: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
    marginTop: theme.spacing(2),
  },
  resonance: { height: 8, borderRadius: 4, margin: theme.spacing(0.5, 0) },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
}))

// Tracks the width of an element, so the canvas graph can fill its container
const useWidth = () => {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const update = () => setWidth(ref.current?.clientWidth || 0)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

const edgeEnd = (end) => (typeof end === 'object' ? end.id : end)

const tribeName = (network, tribeId, translate) =>
  tribeId == null || tribeId < 0
    ? translate('ipods.tribes.freeSpirits')
    : network.tribes?.find((t) => t.id === tribeId)?.name || ''

const prefersReducedMotion = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const IpodDetails = ({ node, network, onSelect, onSelectTribe, onBrowse }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const t = (key, opts) => translate(`ipods.network.${key}`, opts)

  if (!node) {
    return (
      <Typography variant="body2" color="textSecondary">
        {t('selectHint')}
      </Typography>
    )
  }

  const names = Object.fromEntries(network.nodes.map((n) => [n.id, n.name]))
  const neighbors = network.edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">{node.name}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {t('counts', {
            songs: node.songCount,
            artists: node.artistCount,
          })}
        </Typography>
        <TasteBadge score={node.taste} label={node.tasteLabel} />
        <Typography
          variant="body2"
          className={classes.tribeLink}
          onClick={() => onSelectTribe(node.tribe ?? FREE_SPIRITS)}
        >
          <span
            className={classes.dot}
            style={{ backgroundColor: tribeColor(node.tribe) }}
          />
          {translate('ipods.tribes.member', {
            name: tribeName(network, node.tribe, translate),
          })}
        </Typography>
        {node.deepCuts?.length > 0 && (
          <Typography variant="body2" className={classes.tasteLine}>
            <strong>{translate('ipods.taste.deepCuts')}:</strong>{' '}
            {node.deepCuts.join(', ')}
          </Typography>
        )}
        {node.anthems?.length > 0 && (
          <Typography variant="body2" gutterBottom>
            <strong>{translate('ipods.taste.anthems')}:</strong>{' '}
            {node.anthems.join(', ')}
          </Typography>
        )}
        {neighbors.length > 0 && (
          <>
            <Typography variant="overline">{t('closest')}</Typography>
            <List dense disablePadding>
              {neighbors.map((e) => {
                const other = e.source === node.id ? e.target : e.source
                return (
                  <ListItem
                    key={other}
                    button
                    disableGutters
                    onClick={() => onSelect(other)}
                  >
                    <ListItemText
                      primary={`${names[other]} · ${Math.round(e.weight * 100)}%`}
                      secondary={e.sharedArtists.join(', ')}
                    />
                  </ListItem>
                )
              })}
            </List>
          </>
        )}
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={() => onBrowse(node.id)}
        >
          {t('browse')}
        </Button>
        <DownloadIpodButton
          libraryId={node.id}
          name={node.name}
          variant="button"
        />
      </CardContent>
    </Card>
  )
}

const NetworkTab = ({
  network,
  selectedId,
  onSelect,
  tribeId,
  onSelectTribe,
  onBrowse,
}) => {
  const classes = useStyles()
  const theme = useTheme()
  const translate = useTranslate()
  const [containerRef, width] = useWidth()
  const fgRef = useRef()
  const hasSettledRef = useRef(false)
  const [hoverId, setHoverId] = useState(null)
  const [reducedMotion] = useState(prefersReducedMotion)

  // force-graph mutates the objects it receives, so give it its own copies
  const graphData = useMemo(
    () => ({
      nodes: network.nodes.map((n) => ({ ...n })),
      links: network.edges.map((e) => ({ ...e })),
    }),
    [network],
  )
  const maxSongs = Math.max(1, ...network.nodes.map((n) => n.songCount))
  const sortedNodes = useMemo(
    () => [...network.nodes].sort((a, b) => a.name.localeCompare(b.name)),
    [network],
  )
  const selected = network.nodes.find((n) => n.id === selectedId)
  const neighborIds = useMemo(() => {
    const ids = new Set()
    network.edges.forEach((e) => {
      if (e.source === selectedId) ids.add(e.target)
      if (e.target === selectedId) ids.add(e.source)
    })
    return ids
  }, [network, selectedId])

  const highlightTribe = selectedId == null && tribeId != null
  const nodeTribe = (n) => n.tribe ?? FREE_SPIRITS
  const tribeIds = useMemo(
    () =>
      new Set(
        network.nodes
          .filter((n) => (n.tribe ?? FREE_SPIRITS) === tribeId)
          .map((n) => n.id),
      ),
    [network, tribeId],
  )
  const freeSpirits = network.nodes.filter(
    (n) => nodeTribe(n) === FREE_SPIRITS,
  ).length
  const hasSelection = selectedId != null || highlightTribe
  const inFocus = (node) => {
    if (highlightTribe) return nodeTribe(node) === tribeId
    return (
      selectedId == null || node.id === selectedId || neighborIds.has(node.id)
    )
  }
  const isSelectedEdge = (l) =>
    edgeEnd(l.source) === selectedId || edgeEnd(l.target) === selectedId

  // Moves the camera to the selected iPod and its closest matches, or shows the whole
  // network when nothing is selected. Returns false if the layout is not ready yet
  const focusCamera = useCallback(() => {
    const fg = fgRef.current
    if (!fg) return false
    const ms = (d) => (reducedMotion ? 0 : d)
    if (selectedId == null && tribeId != null) {
      fg.zoomToFit(ms(FOCUS_MS), 60, (n) => tribeIds.has(n.id))
      return true
    }
    if (selectedId == null) {
      fg.zoomToFit(ms(FIT_MS), 40)
      return true
    }
    const node = graphData.nodes.find((n) => n.id === selectedId)
    if (node?.x == null) return false
    if (neighborIds.size === 0) {
      fg.centerAt(node.x, node.y, ms(FOCUS_MS))
      fg.zoom(4, ms(FOCUS_MS))
    } else {
      fg.zoomToFit(
        ms(FOCUS_MS),
        60,
        (n) => n.id === selectedId || neighborIds.has(n.id),
      )
    }
    return true
  }, [graphData, selectedId, neighborIds, tribeId, tribeIds, reducedMotion])

  // Follow the selection, once the initial layout has settled (see onEngineStop)
  useEffect(() => {
    if (hasSettledRef.current) focusCamera()
  }, [focusCamera])

  const handleEngineStop = () => {
    if (hasSettledRef.current) return
    hasSettledRef.current = true
    focusCamera()
  }

  const handleNodeHover = (node) => {
    setHoverId(node ? node.id : null)
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : ''
    }
  }

  const nodeColor = (n) => tribeColor(n.tribe)

  const drawNode = (node, ctx, scale) => {
    const radius = 4 + 10 * Math.sqrt(node.songCount / maxSongs)
    const focused = inFocus(node)
    ctx.save()
    ctx.globalAlpha = focused ? 1 : DIMMED_ALPHA

    // Pulsing halo around the selected iPod
    if (node.id === selectedId && !reducedMotion) {
      const pulse = 3 * Math.sin(performance.now() / 300)
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 5 + pulse, 0, 2 * Math.PI)
      ctx.fillStyle = alpha(theme.palette.secondary.main, 0.25)
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = nodeColor(node)
    ctx.fill()

    const hovered = node.id === hoverId
    if (hovered) {
      ctx.lineWidth = 2 / scale
      ctx.strokeStyle = theme.palette.text.primary
      ctx.stroke()
    }

    if (focused || hovered) {
      const fontSize = 12 / scale
      ctx.font = `${hovered ? 'bold ' : ''}${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = theme.palette.text.primary
      ctx.fillText(node.name, node.x, node.y + radius + 2 / scale)
    }
    ctx.restore()
  }

  const linkColor = (l) => {
    if (!hasSelection) return theme.palette.text.secondary
    if (highlightTribe) {
      return tribeIds.has(edgeEnd(l.source)) && tribeIds.has(edgeEnd(l.target))
        ? tribeColor(tribeId)
        : alpha(theme.palette.text.secondary, 0.08)
    }
    return isSelectedEdge(l)
      ? theme.palette.secondary.main
      : alpha(theme.palette.text.secondary, 0.08)
  }

  const handleResetView = () => {
    if (selectedId == null && tribeId == null) {
      focusCamera()
    } else {
      onSelect(null)
      onSelectTribe(null)
    }
  }

  const tribes = network.tribes || []
  const legendChip = (id, name, size) => (
    <Chip
      key={id}
      size="small"
      clickable
      variant={tribeId === id ? 'default' : 'outlined'}
      onClick={() => onSelectTribe(tribeId === id ? null : id)}
      label={
        <>
          <span
            className={classes.dot}
            style={{ backgroundColor: tribeColor(id) }}
          />
          {`${name} · ${size}`}
        </>
      }
    />
  )

  return (
    <>
      {tribes.length > 0 && (
        <div
          className={classes.legend}
          aria-label={translate('ipods.tribes.title')}
        >
          {tribes.map((t) => legendChip(t.id, t.name, t.size))}
          {freeSpirits > 0 &&
            legendChip(
              FREE_SPIRITS,
              translate('ipods.tribes.freeSpirits'),
              freeSpirits,
            )}
        </div>
      )}
      <div className={classes.networkLayout}>
        <div className={classes.graph} ref={containerRef}>
          {network.nodes.length === 0 ? (
            <div className={classes.center}>
              <Typography color="textSecondary">
                {translate('ipods.network.empty')}
              </Typography>
            </div>
          ) : (
            width > 0 && (
              <>
                <Tooltip title={translate('ipods.network.resetView')}>
                  <IconButton
                    size="small"
                    className={classes.resetView}
                    aria-label={translate('ipods.network.resetView')}
                    onClick={handleResetView}
                  >
                    <MdZoomOutMap size={18} />
                  </IconButton>
                </Tooltip>
                <ForceGraph2D
                  ref={fgRef}
                  graphData={graphData}
                  width={width}
                  height={GRAPH_HEIGHT}
                  backgroundColor={theme.palette.background.paper}
                  nodeLabel={(n) => n.name}
                  nodeCanvasObject={drawNode}
                  nodePointerAreaPaint={(node, color, ctx) => {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI)
                    ctx.fillStyle = color
                    ctx.fill()
                  }}
                  linkLabel={(l) =>
                    `${Math.round(l.weight * 100)}% · ${l.sharedArtists.join(', ')}`
                  }
                  linkWidth={(l) =>
                    (isSelectedEdge(l) ? 2 : 0.5) + 6 * l.weight
                  }
                  linkColor={linkColor}
                  linkDirectionalParticles={(l) =>
                    !reducedMotion && isSelectedEdge(l)
                      ? 2 + Math.round(4 * l.weight)
                      : 0
                  }
                  linkDirectionalParticleSpeed={0.006}
                  linkDirectionalParticleWidth={3}
                  linkDirectionalParticleColor={() =>
                    theme.palette.secondary.main
                  }
                  // Keep redrawing while an iPod is selected, for the pulse and particles
                  autoPauseRedraw={!hasSelection || reducedMotion}
                  onNodeClick={(n) => onSelect(n.id)}
                  onNodeHover={handleNodeHover}
                  onBackgroundClick={() => onSelect(null)}
                  onEngineStop={handleEngineStop}
                  cooldownTicks={150}
                />
              </>
            )
          )}
        </div>
        <div className={classes.side}>
          <Autocomplete
            className={classes.search}
            options={sortedNodes}
            value={selected || null}
            getOptionLabel={(n) => n.name}
            getOptionSelected={(a, b) => a.id === b.id}
            onChange={(_, node) => onSelect(node ? node.id : null)}
            noOptionsText={translate('ipods.network.noMatch')}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                size="small"
                label={translate('ipods.network.search')}
              />
            )}
          />
          <IpodDetails
            node={selected}
            network={network}
            onSelect={onSelect}
            onSelectTribe={onSelectTribe}
            onBrowse={onBrowse}
          />
        </div>
      </div>
    </>
  )
}

export const MatchTab = ({ onSelectIpod }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const [input, setInput] = useState('')
  const [options, setOptions] = useState([])
  const [artists, setArtists] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const t = (key, opts) => translate(`ipods.match.${key}`, opts)

  useEffect(() => {
    if (!input) return
    let active = true
    // Search all iPods, not only the libraries selected in the library selector (the
    // dataProvider would filter by them), as matching considers all iPods too
    const query = new URLSearchParams({
      name: input,
      missing: 'false',
      _sort: 'name',
      _order: 'ASC',
      _start: '0',
      _end: '10',
    })
    const timer = setTimeout(() => {
      httpClient(`${REST_URL}/artist?${query}`)
        .then(({ json }) => active && setOptions(uniqueArtists(json)))
        .catch(() => active && setOptions([]))
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [input])

  const handleMatch = useCallback(() => {
    setLoading(true)
    const query = artists
      .map((a) => `artistId=${encodeURIComponent(a.id)}`)
      .join('&')
    httpClient(`/api/ipods/match?${query}`)
      .then(({ json }) => setResult(json))
      .catch(() => setResult({ matches: [], notFound: [] }))
      .finally(() => setLoading(false))
  }, [artists])

  const notFoundNames = artists
    .filter((a) => result?.notFound.includes(a.id))
    .map((a) => a.name)

  return (
    <div>
      <Typography variant="body2" color="textSecondary">
        {t('hint')}
      </Typography>
      <div className={classes.matchForm}>
        <Autocomplete
          multiple
          fullWidth
          options={options}
          value={artists}
          getOptionLabel={(a) => a.name}
          getOptionSelected={(a, b) => a.id === b.id}
          filterOptions={(x) => x}
          onChange={(_, value) => setArtists(value)}
          onInputChange={(_, value) => setInput(value)}
          renderInput={(params) => (
            <TextField {...params} variant="outlined" label={t('artists')} />
          )}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleMatch}
          disabled={artists.length === 0 || loading}
          style={{ height: 56, whiteSpace: 'nowrap' }}
        >
          {t('find')}
        </Button>
      </div>
      {loading && <LinearProgress style={{ marginTop: 16 }} />}
      {result && !loading && (
        <>
          {notFoundNames.length > 0 && (
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ marginTop: 16 }}
            >
              {t('notFound', { names: notFoundNames.join(', ') })}
            </Typography>
          )}
          {result.matches.length === 0 ? (
            <Typography style={{ marginTop: 16 }}>{t('noMatches')}</Typography>
          ) : (
            <List>
              {result.matches.map((m, idx) => (
                <ListItem
                  key={m.id}
                  button
                  divider
                  onClick={() => onSelectIpod(m.id)}
                >
                  <ListItemText
                    primary={`${idx + 1}. ${m.name} · ${t('resonance', { value: m.resonance })}`}
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <>
                        <TasteBadge
                          score={m.taste}
                          label={tasteLabelOf(m.taste)}
                        />
                        <LinearProgress
                          variant="determinate"
                          value={m.resonance}
                          className={classes.resonance}
                        />
                        <div className={classes.chips}>
                          {m.matched.map((a) => (
                            <Chip
                              key={a.id}
                              size="small"
                              label={`${a.name} · ${a.songCount}`}
                            />
                          ))}
                        </div>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </div>
  )
}

export const IpodNetworkDialog = ({ open, onClose }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const [tab, setTab] = useState(0)
  const [network, setNetwork] = useState(null)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [tribeId, setTribeId] = useState(null)
  // Selecting an iPod or a tribe clears the other
  const selectIpod = useCallback((id) => {
    setSelectedId(id)
    setTribeId(null)
  }, [])
  const selectTribe = useCallback((id) => {
    setTribeId(id)
    setSelectedId(null)
  }, [])

  useEffect(() => {
    if (!open) return
    httpClient('/api/ipods/network')
      .then(({ json }) => setNetwork(json))
      .catch(() => setError(true))
  }, [open])

  const handleBrowse = useBrowseIpod(onClose)

  const handleSelectIpod = useCallback((id) => {
    setSelectedId(id)
    setTab(0)
  }, [])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle onClose={onClose}>
        {translate('ipods.network.title')}
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        indicatorColor="primary"
        variant="fullWidth"
      >
        <Tab label={translate('ipods.network.tab')} />
        <Tab label={translate('ipods.match.tab')} />
      </Tabs>
      <DialogContent dividers className={classes.content}>
        {tab === 0 && (
          <>
            {!network && !error && (
              <div className={classes.center}>
                <CircularProgress />
              </div>
            )}
            {error && (
              <Typography color="error">
                {translate('ipods.network.error')}
              </Typography>
            )}
            {network && (
              <NetworkTab
                network={network}
                selectedId={selectedId}
                onSelect={selectIpod}
                tribeId={tribeId}
                onSelectTribe={selectTribe}
                onBrowse={handleBrowse}
              />
            )}
          </>
        )}
        {tab === 1 && <MatchTab onSelectIpod={handleSelectIpod} />}
      </DialogContent>
    </Dialog>
  )
}

export const IpodNetworkButton = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const [open, setOpen] = useState(false)
  const title = translate('ipods.network.title')

  return (
    <>
      <Tooltip title={title}>
        <IconButton
          className={classes.button}
          onClick={() => setOpen(true)}
          aria-label={title}
          aria-haspopup="true"
        >
          <IpodIcon size={20} />
        </IconButton>
      </Tooltip>
      {open && <IpodNetworkDialog open={open} onClose={() => setOpen(false)} />}
    </>
  )
}

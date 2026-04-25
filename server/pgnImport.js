import { Chess } from 'chess.js'

const RESULT_MAP = {
  '1-0': 'white',
  '0-1': 'black',
  '1/2-1/2': 'draw',
  '*': null,
}

const CONTEXT_HEADER_FIELDS = ['Event', 'Date', 'Opening', 'WhiteElo', 'BlackElo']

/**
 * chess.js 1.4's PGN parser mishandles tag names that end with a digit (e.g. [Source2 "..."]),
 * which makes loadPgn throw while reading the movetext. Drop those header lines only; tags like
 * PlyCount are unaffected because the name does not end with a digit character.
 */
export function normalizePgnForChessJs(gameText) {
  const lines = gameText.replace(/\r\n/g, '\n').split('\n')
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    const tagMatch = trimmed.match(/^\[([^\s\]]+)\s+"/)
    if (tagMatch && /\d$/.test(tagMatch[1])) {
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/**
 * Split a PGN file that may contain multiple games.
 */
export function splitPgnGames(rawText) {
  const text = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return []
  }
  return text
    .split(/\n\n(?=\[)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
}

function buildContext(headers) {
  const parts = []
  for (const field of CONTEXT_HEADER_FIELDS) {
    const val = headers[field]
    if (val && val !== '?') {
      parts.push(`${field}: ${val}`)
    }
  }
  return parts.length > 0 ? parts.join(', ') : null
}

function mapResult(headerResult) {
  if (!headerResult) {
    return null
  }
  return RESULT_MAP[headerResult] ?? null
}

/**
 * Parse one PGN game block into data ready for DB insert.
 * @returns {{ white: string, black: string, timeControl: string|null, result: string|null, context: string|null, sans: string[] }}
 */
export function parseSinglePgnGame(gameText) {
  const chess = new Chess()
  chess.loadPgn(normalizePgnForChessJs(gameText), { strict: false })
  const headers = chess.getHeaders()

  const white = headers.White && headers.White !== '?' ? headers.White : 'Unknown'
  const black = headers.Black && headers.Black !== '?' ? headers.Black : 'Unknown'
  const timeControl = headers.TimeControl && headers.TimeControl !== '?' ? headers.TimeControl : null
  const result = mapResult(headers.Result)
  const context = buildContext(headers)
  const sans = chess.history()

  if (sans.length === 0) {
    throw new Error('This game has no moves in the main line.')
  }

  return { white, black, timeControl, result, context, sans }
}

/**
 * genre-data.js
 * Comprehensive genre mapping data for Spotify personality analyzer.
 * Plain JavaScript - attaches everything to the window object.
 */

window.GENRE_DATA = {

  // ---------------------------------------------------------------------------
  // moodMap  (200+ entries)
  // Each genre maps to { melancholy, energy, angst, chill, hype, romance, darkness, quirkiness }
  // All values 0-100
  // ---------------------------------------------------------------------------
  moodMap: {

    // ── Rock (20+ variants) ──────────────────────────────────────────────
    "rock":                { melancholy: 35, energy: 65, angst: 40, chill: 30, hype: 50, romance: 30, darkness: 25, quirkiness: 20 },
    "classic rock":        { melancholy: 30, energy: 70, angst: 30, chill: 35, hype: 55, romance: 35, darkness: 20, quirkiness: 15 },
    "indie rock":          { melancholy: 50, energy: 55, angst: 45, chill: 40, hype: 35, romance: 40, darkness: 30, quirkiness: 55 },
    "alternative rock":    { melancholy: 45, energy: 60, angst: 55, chill: 30, hype: 40, romance: 30, darkness: 35, quirkiness: 45 },
    "alt rock":            { melancholy: 45, energy: 60, angst: 55, chill: 30, hype: 40, romance: 30, darkness: 35, quirkiness: 45 },
    "grunge":              { melancholy: 65, energy: 70, angst: 80, chill: 10, hype: 45, romance: 15, darkness: 60, quirkiness: 25 },
    "punk rock":           { melancholy: 20, energy: 85, angst: 75, chill: 5,  hype: 70, romance: 10, darkness: 30, quirkiness: 40 },
    "post-punk":           { melancholy: 65, energy: 55, angst: 60, chill: 25, hype: 25, romance: 20, darkness: 65, quirkiness: 55 },
    "garage rock":         { melancholy: 25, energy: 75, angst: 50, chill: 15, hype: 60, romance: 20, darkness: 25, quirkiness: 45 },
    "psychedelic rock":    { melancholy: 40, energy: 50, angst: 25, chill: 55, hype: 35, romance: 35, darkness: 35, quirkiness: 80 },
    "prog rock":           { melancholy: 40, energy: 55, angst: 30, chill: 40, hype: 30, romance: 25, darkness: 30, quirkiness: 75 },
    "progressive rock":    { melancholy: 40, energy: 55, angst: 30, chill: 40, hype: 30, romance: 25, darkness: 30, quirkiness: 75 },
    "southern rock":       { melancholy: 30, energy: 65, angst: 25, chill: 40, hype: 50, romance: 30, darkness: 15, quirkiness: 20 },
    "soft rock":           { melancholy: 40, energy: 30, angst: 15, chill: 65, hype: 15, romance: 60, darkness: 10, quirkiness: 10 },
    "hard rock":           { melancholy: 20, energy: 80, angst: 50, chill: 10, hype: 65, romance: 15, darkness: 35, quirkiness: 15 },
    "stoner rock":         { melancholy: 35, energy: 60, angst: 30, chill: 50, hype: 35, romance: 10, darkness: 45, quirkiness: 55 },
    "math rock":           { melancholy: 30, energy: 60, angst: 25, chill: 30, hype: 30, romance: 10, darkness: 15, quirkiness: 90 },
    "noise rock":          { melancholy: 35, energy: 80, angst: 70, chill: 5,  hype: 40, romance: 5,  darkness: 55, quirkiness: 75 },
    "art rock":            { melancholy: 45, energy: 45, angst: 35, chill: 35, hype: 20, romance: 25, darkness: 35, quirkiness: 85 },
    "surf rock":           { melancholy: 10, energy: 65, angst: 10, chill: 55, hype: 50, romance: 25, darkness: 5,  quirkiness: 45 },
    "blues rock":          { melancholy: 50, energy: 60, angst: 35, chill: 35, hype: 40, romance: 35, darkness: 30, quirkiness: 15 },
    "folk rock":           { melancholy: 50, energy: 40, angst: 30, chill: 50, hype: 20, romance: 45, darkness: 20, quirkiness: 30 },
    "space rock":          { melancholy: 45, energy: 50, angst: 20, chill: 55, hype: 25, romance: 20, darkness: 40, quirkiness: 70 },
    "glam rock":           { melancholy: 20, energy: 70, angst: 25, chill: 20, hype: 65, romance: 40, darkness: 15, quirkiness: 70 },
    "arena rock":          { melancholy: 25, energy: 75, angst: 25, chill: 20, hype: 75, romance: 35, darkness: 15, quirkiness: 10 },
    "yacht rock":          { melancholy: 20, energy: 30, angst: 5,  chill: 75, hype: 15, romance: 55, darkness: 5,  quirkiness: 35 },

    // ── Metal (15+ variants) ─────────────────────────────────────────────
    "metal":               { melancholy: 30, energy: 85, angst: 65, chill: 5,  hype: 65, romance: 5,  darkness: 60, quirkiness: 25 },
    "heavy metal":         { melancholy: 25, energy: 90, angst: 60, chill: 5,  hype: 70, romance: 5,  darkness: 55, quirkiness: 20 },
    "thrash metal":        { melancholy: 15, energy: 95, angst: 75, chill: 2,  hype: 75, romance: 2,  darkness: 55, quirkiness: 20 },
    "death metal":         { melancholy: 25, energy: 95, angst: 70, chill: 2,  hype: 60, romance: 2,  darkness: 90, quirkiness: 35 },
    "black metal":         { melancholy: 50, energy: 85, angst: 75, chill: 5,  hype: 40, romance: 2,  darkness: 95, quirkiness: 45 },
    "doom metal":          { melancholy: 70, energy: 55, angst: 60, chill: 15, hype: 15, romance: 5,  darkness: 85, quirkiness: 40 },
    "power metal":         { melancholy: 15, energy: 90, angst: 25, chill: 5,  hype: 85, romance: 20, darkness: 20, quirkiness: 45 },
    "metalcore":           { melancholy: 35, energy: 90, angst: 80, chill: 3,  hype: 70, romance: 10, darkness: 55, quirkiness: 20 },
    "deathcore":           { melancholy: 25, energy: 95, angst: 85, chill: 2,  hype: 60, romance: 2,  darkness: 85, quirkiness: 25 },
    "nu metal":            { melancholy: 40, energy: 80, angst: 75, chill: 5,  hype: 60, romance: 10, darkness: 50, quirkiness: 30 },
    "prog metal":          { melancholy: 35, energy: 75, angst: 40, chill: 15, hype: 40, romance: 10, darkness: 40, quirkiness: 70 },
    "progressive metal":   { melancholy: 35, energy: 75, angst: 40, chill: 15, hype: 40, romance: 10, darkness: 40, quirkiness: 70 },
    "industrial metal":    { melancholy: 30, energy: 85, angst: 70, chill: 3,  hype: 55, romance: 5,  darkness: 70, quirkiness: 50 },
    "gothic metal":        { melancholy: 65, energy: 60, angst: 55, chill: 15, hype: 25, romance: 35, darkness: 80, quirkiness: 40 },
    "sludge metal":        { melancholy: 55, energy: 70, angst: 65, chill: 10, hype: 25, romance: 2,  darkness: 75, quirkiness: 40 },
    "symphonic metal":     { melancholy: 40, energy: 80, angst: 35, chill: 10, hype: 60, romance: 30, darkness: 45, quirkiness: 50 },
    "speed metal":         { melancholy: 10, energy: 95, angst: 50, chill: 2,  hype: 80, romance: 5,  darkness: 40, quirkiness: 25 },
    "groove metal":        { melancholy: 20, energy: 85, angst: 55, chill: 5,  hype: 65, romance: 5,  darkness: 50, quirkiness: 20 },
    "folk metal":          { melancholy: 35, energy: 75, angst: 30, chill: 15, hype: 55, romance: 15, darkness: 35, quirkiness: 65 },
    "djent":               { melancholy: 25, energy: 80, angst: 45, chill: 10, hype: 50, romance: 5,  darkness: 40, quirkiness: 70 },

    // ── Pop (15+ variants) ───────────────────────────────────────────────
    "pop":                 { melancholy: 25, energy: 60, angst: 15, chill: 35, hype: 60, romance: 55, darkness: 10, quirkiness: 15 },
    "synth pop":           { melancholy: 35, energy: 55, angst: 20, chill: 40, hype: 45, romance: 45, darkness: 25, quirkiness: 45 },
    "synthpop":            { melancholy: 35, energy: 55, angst: 20, chill: 40, hype: 45, romance: 45, darkness: 25, quirkiness: 45 },
    "indie pop":           { melancholy: 40, energy: 45, angst: 25, chill: 50, hype: 30, romance: 45, darkness: 15, quirkiness: 60 },
    "dream pop":           { melancholy: 60, energy: 25, angst: 20, chill: 75, hype: 10, romance: 55, darkness: 30, quirkiness: 50 },
    "electropop":          { melancholy: 20, energy: 70, angst: 15, chill: 25, hype: 70, romance: 40, darkness: 10, quirkiness: 35 },
    "dance pop":           { melancholy: 10, energy: 80, angst: 5,  chill: 15, hype: 85, romance: 40, darkness: 5,  quirkiness: 15 },
    "power pop":           { melancholy: 25, energy: 70, angst: 20, chill: 25, hype: 55, romance: 45, darkness: 10, quirkiness: 25 },
    "art pop":             { melancholy: 40, energy: 45, angst: 30, chill: 35, hype: 25, romance: 30, darkness: 25, quirkiness: 80 },
    "hyperpop":            { melancholy: 20, energy: 85, angst: 35, chill: 5,  hype: 90, romance: 20, darkness: 15, quirkiness: 95 },
    "k-pop":               { melancholy: 20, energy: 75, angst: 15, chill: 20, hype: 85, romance: 50, darkness: 10, quirkiness: 40 },
    "j-pop":               { melancholy: 25, energy: 65, angst: 15, chill: 30, hype: 60, romance: 45, darkness: 10, quirkiness: 50 },
    "bedroom pop":         { melancholy: 50, energy: 25, angst: 30, chill: 70, hype: 10, romance: 50, darkness: 15, quirkiness: 55 },
    "dark pop":            { melancholy: 55, energy: 50, angst: 45, chill: 30, hype: 35, romance: 40, darkness: 60, quirkiness: 35 },
    "teen pop":            { melancholy: 15, energy: 70, angst: 10, chill: 25, hype: 75, romance: 55, darkness: 5,  quirkiness: 10 },
    "chamber pop":         { melancholy: 50, energy: 35, angst: 25, chill: 50, hype: 15, romance: 45, darkness: 20, quirkiness: 65 },
    "bubblegum pop":       { melancholy: 5,  energy: 75, angst: 2,  chill: 20, hype: 80, romance: 40, darkness: 2,  quirkiness: 25 },
    "europop":             { melancholy: 10, energy: 75, angst: 5,  chill: 20, hype: 80, romance: 35, darkness: 5,  quirkiness: 30 },
    "latin pop":           { melancholy: 25, energy: 65, angst: 15, chill: 30, hype: 65, romance: 65, darkness: 10, quirkiness: 20 },
    "sunshine pop":        { melancholy: 10, energy: 55, angst: 5,  chill: 55, hype: 40, romance: 45, darkness: 2,  quirkiness: 35 },

    // ── Hip-Hop / Rap (15+ variants) ─────────────────────────────────────
    "hip hop":             { melancholy: 30, energy: 70, angst: 40, chill: 25, hype: 70, romance: 25, darkness: 30, quirkiness: 25 },
    "rap":                 { melancholy: 25, energy: 75, angst: 45, chill: 20, hype: 75, romance: 20, darkness: 30, quirkiness: 20 },
    "trap":                { melancholy: 35, energy: 75, angst: 45, chill: 20, hype: 80, romance: 15, darkness: 45, quirkiness: 20 },
    "boom bap":            { melancholy: 30, energy: 65, angst: 35, chill: 35, hype: 55, romance: 15, darkness: 25, quirkiness: 30 },
    "underground hip hop": { melancholy: 40, energy: 60, angst: 45, chill: 30, hype: 40, romance: 15, darkness: 35, quirkiness: 55 },
    "southern hip hop":    { melancholy: 20, energy: 75, angst: 35, chill: 25, hype: 80, romance: 20, darkness: 25, quirkiness: 25 },
    "west coast rap":      { melancholy: 25, energy: 70, angst: 40, chill: 35, hype: 70, romance: 20, darkness: 30, quirkiness: 25 },
    "east coast hip hop":  { melancholy: 30, energy: 70, angst: 45, chill: 25, hype: 65, romance: 15, darkness: 30, quirkiness: 30 },
    "gangsta rap":         { melancholy: 25, energy: 75, angst: 55, chill: 20, hype: 70, romance: 15, darkness: 50, quirkiness: 15 },
    "emo rap":             { melancholy: 70, energy: 55, angst: 75, chill: 20, hype: 45, romance: 30, darkness: 55, quirkiness: 30 },
    "cloud rap":           { melancholy: 45, energy: 40, angst: 30, chill: 60, hype: 35, romance: 20, darkness: 35, quirkiness: 55 },
    "lo-fi hip hop":       { melancholy: 45, energy: 20, angst: 15, chill: 85, hype: 10, romance: 30, darkness: 15, quirkiness: 35 },
    "drill":               { melancholy: 25, energy: 80, angst: 60, chill: 10, hype: 80, romance: 5,  darkness: 65, quirkiness: 15 },
    "grime":               { melancholy: 20, energy: 85, angst: 55, chill: 10, hype: 80, romance: 10, darkness: 40, quirkiness: 30 },
    "phonk":               { melancholy: 35, energy: 75, angst: 40, chill: 20, hype: 70, romance: 10, darkness: 55, quirkiness: 45 },
    "crunk":               { melancholy: 5,  energy: 90, angst: 30, chill: 5,  hype: 95, romance: 10, darkness: 20, quirkiness: 25 },
    "conscious hip hop":   { melancholy: 40, energy: 55, angst: 45, chill: 35, hype: 40, romance: 20, darkness: 30, quirkiness: 40 },
    "dirty south":         { melancholy: 15, energy: 80, angst: 30, chill: 20, hype: 85, romance: 15, darkness: 25, quirkiness: 20 },
    "mumble rap":          { melancholy: 25, energy: 65, angst: 25, chill: 35, hype: 70, romance: 20, darkness: 25, quirkiness: 20 },
    "abstract hip hop":    { melancholy: 40, energy: 50, angst: 35, chill: 35, hype: 30, romance: 15, darkness: 30, quirkiness: 75 },

    // ── Electronic (20+ variants) ────────────────────────────────────────
    "electronic":          { melancholy: 25, energy: 65, angst: 15, chill: 35, hype: 55, romance: 20, darkness: 20, quirkiness: 40 },
    "edm":                 { melancholy: 5,  energy: 90, angst: 5,  chill: 5,  hype: 95, romance: 15, darkness: 5,  quirkiness: 15 },
    "house":               { melancholy: 15, energy: 75, angst: 5,  chill: 30, hype: 75, romance: 25, darkness: 10, quirkiness: 20 },
    "deep house":          { melancholy: 30, energy: 55, angst: 5,  chill: 60, hype: 45, romance: 35, darkness: 20, quirkiness: 25 },
    "tech house":          { melancholy: 15, energy: 70, angst: 5,  chill: 30, hype: 65, romance: 10, darkness: 15, quirkiness: 25 },
    "techno":              { melancholy: 20, energy: 80, angst: 15, chill: 15, hype: 70, romance: 5,  darkness: 35, quirkiness: 30 },
    "trance":              { melancholy: 30, energy: 80, angst: 10, chill: 20, hype: 75, romance: 30, darkness: 15, quirkiness: 25 },
    "dubstep":             { melancholy: 15, energy: 90, angst: 35, chill: 5,  hype: 85, romance: 5,  darkness: 35, quirkiness: 40 },
    "drum and bass":       { melancholy: 15, energy: 90, angst: 25, chill: 10, hype: 80, romance: 10, darkness: 25, quirkiness: 30 },
    "ambient":             { melancholy: 50, energy: 10, angst: 10, chill: 90, hype: 2,  romance: 25, darkness: 30, quirkiness: 40 },
    "downtempo":           { melancholy: 40, energy: 25, angst: 10, chill: 80, hype: 10, romance: 30, darkness: 20, quirkiness: 35 },
    "chillwave":           { melancholy: 45, energy: 30, angst: 15, chill: 80, hype: 15, romance: 35, darkness: 15, quirkiness: 50 },
    "vaporwave":           { melancholy: 55, energy: 20, angst: 15, chill: 70, hype: 10, romance: 25, darkness: 20, quirkiness: 90 },
    "synthwave":           { melancholy: 30, energy: 65, angst: 15, chill: 35, hype: 55, romance: 35, darkness: 30, quirkiness: 50 },
    "retrowave":           { melancholy: 30, energy: 65, angst: 15, chill: 35, hype: 55, romance: 35, darkness: 30, quirkiness: 50 },
    "future bass":         { melancholy: 25, energy: 75, angst: 10, chill: 25, hype: 80, romance: 25, darkness: 10, quirkiness: 35 },
    "hardstyle":           { melancholy: 5,  energy: 95, angst: 20, chill: 2,  hype: 95, romance: 5,  darkness: 25, quirkiness: 20 },
    "breakbeat":           { melancholy: 15, energy: 75, angst: 15, chill: 20, hype: 65, romance: 10, darkness: 15, quirkiness: 40 },
    "idm":                 { melancholy: 40, energy: 45, angst: 25, chill: 40, hype: 15, romance: 10, darkness: 30, quirkiness: 85 },
    "industrial":          { melancholy: 30, energy: 80, angst: 65, chill: 5,  hype: 45, romance: 5,  darkness: 70, quirkiness: 50 },
    "jungle":              { melancholy: 15, energy: 85, angst: 20, chill: 10, hype: 75, romance: 10, darkness: 20, quirkiness: 35 },
    "garage":              { melancholy: 20, energy: 70, angst: 10, chill: 25, hype: 65, romance: 20, darkness: 10, quirkiness: 25 },
    "uk garage":           { melancholy: 20, energy: 70, angst: 10, chill: 25, hype: 65, romance: 25, darkness: 10, quirkiness: 25 },
    "electro":             { melancholy: 15, energy: 80, angst: 15, chill: 15, hype: 70, romance: 10, darkness: 20, quirkiness: 35 },
    "electronica":         { melancholy: 30, energy: 50, angst: 15, chill: 45, hype: 35, romance: 20, darkness: 25, quirkiness: 50 },
    "minimal techno":      { melancholy: 30, energy: 60, angst: 10, chill: 35, hype: 45, romance: 5,  darkness: 30, quirkiness: 45 },
    "acid house":          { melancholy: 10, energy: 80, angst: 10, chill: 15, hype: 75, romance: 10, darkness: 15, quirkiness: 55 },
    "progressive house":   { melancholy: 25, energy: 65, angst: 5,  chill: 35, hype: 60, romance: 25, darkness: 10, quirkiness: 20 },
    "tropical house":      { melancholy: 15, energy: 55, angst: 5,  chill: 60, hype: 55, romance: 40, darkness: 5,  quirkiness: 20 },

    // ── Punk / Emo (10+ variants) ────────────────────────────────────────
    "punk":                { melancholy: 20, energy: 90, angst: 80, chill: 5,  hype: 70, romance: 10, darkness: 30, quirkiness: 40 },
    "pop punk":            { melancholy: 35, energy: 80, angst: 60, chill: 10, hype: 65, romance: 35, darkness: 15, quirkiness: 25 },
    "hardcore punk":       { melancholy: 15, energy: 95, angst: 90, chill: 2,  hype: 65, romance: 2,  darkness: 40, quirkiness: 30 },
    "hardcore":            { melancholy: 15, energy: 95, angst: 85, chill: 2,  hype: 65, romance: 2,  darkness: 45, quirkiness: 25 },
    "emo":                 { melancholy: 80, energy: 55, angst: 85, chill: 15, hype: 30, romance: 55, darkness: 50, quirkiness: 30 },
    "screamo":             { melancholy: 60, energy: 90, angst: 95, chill: 2,  hype: 50, romance: 20, darkness: 60, quirkiness: 35 },
    "post-hardcore":       { melancholy: 50, energy: 80, angst: 75, chill: 5,  hype: 50, romance: 25, darkness: 45, quirkiness: 30 },
    "skate punk":          { melancholy: 15, energy: 90, angst: 55, chill: 5,  hype: 75, romance: 10, darkness: 15, quirkiness: 35 },
    "emocore":             { melancholy: 70, energy: 70, angst: 85, chill: 5,  hype: 40, romance: 40, darkness: 45, quirkiness: 25 },
    "mathcore":            { melancholy: 25, energy: 90, angst: 70, chill: 2,  hype: 45, romance: 2,  darkness: 45, quirkiness: 85 },
    "crust punk":          { melancholy: 30, energy: 90, angst: 85, chill: 2,  hype: 50, romance: 2,  darkness: 55, quirkiness: 35 },
    "melodic hardcore":    { melancholy: 35, energy: 85, angst: 65, chill: 5,  hype: 60, romance: 15, darkness: 35, quirkiness: 20 },
    "straight edge":       { melancholy: 20, energy: 85, angst: 70, chill: 5,  hype: 60, romance: 5,  darkness: 30, quirkiness: 30 },

    // ── R&B / Soul (8+ variants) ─────────────────────────────────────────
    "r&b":                 { melancholy: 40, energy: 45, angst: 20, chill: 55, hype: 35, romance: 75, darkness: 15, quirkiness: 15 },
    "soul":                { melancholy: 45, energy: 50, angst: 25, chill: 45, hype: 30, romance: 70, darkness: 15, quirkiness: 15 },
    "neo soul":            { melancholy: 40, energy: 35, angst: 15, chill: 65, hype: 20, romance: 65, darkness: 15, quirkiness: 35 },
    "funk":                { melancholy: 10, energy: 80, angst: 10, chill: 30, hype: 75, romance: 35, darkness: 5,  quirkiness: 45 },
    "motown":              { melancholy: 30, energy: 60, angst: 15, chill: 40, hype: 50, romance: 65, darkness: 10, quirkiness: 10 },
    "gospel":              { melancholy: 30, energy: 65, angst: 20, chill: 30, hype: 55, romance: 30, darkness: 5,  quirkiness: 10 },
    "blues":               { melancholy: 70, energy: 40, angst: 45, chill: 45, hype: 15, romance: 40, darkness: 40, quirkiness: 15 },
    "quiet storm":         { melancholy: 35, energy: 20, angst: 10, chill: 80, hype: 5,  romance: 85, darkness: 10, quirkiness: 10 },
    "contemporary r&b":    { melancholy: 35, energy: 50, angst: 15, chill: 50, hype: 45, romance: 70, darkness: 15, quirkiness: 15 },
    "alternative r&b":     { melancholy: 45, energy: 40, angst: 25, chill: 55, hype: 25, romance: 55, darkness: 25, quirkiness: 45 },
    "rhythm and blues":    { melancholy: 40, energy: 50, angst: 20, chill: 45, hype: 35, romance: 65, darkness: 15, quirkiness: 10 },

    // ── Country / Folk (8+ variants) ─────────────────────────────────────
    "country":             { melancholy: 40, energy: 50, angst: 20, chill: 45, hype: 35, romance: 45, darkness: 15, quirkiness: 15 },
    "bluegrass":           { melancholy: 40, energy: 60, angst: 15, chill: 40, hype: 40, romance: 30, darkness: 10, quirkiness: 35 },
    "americana":           { melancholy: 50, energy: 40, angst: 30, chill: 50, hype: 20, romance: 40, darkness: 25, quirkiness: 25 },
    "outlaw country":      { melancholy: 45, energy: 55, angst: 40, chill: 35, hype: 35, romance: 25, darkness: 30, quirkiness: 35 },
    "folk":                { melancholy: 55, energy: 30, angst: 25, chill: 60, hype: 10, romance: 45, darkness: 20, quirkiness: 30 },
    "indie folk":          { melancholy: 60, energy: 25, angst: 30, chill: 60, hype: 10, romance: 50, darkness: 20, quirkiness: 45 },
    "alt-country":         { melancholy: 50, energy: 45, angst: 35, chill: 40, hype: 25, romance: 35, darkness: 25, quirkiness: 35 },
    "country rock":        { melancholy: 35, energy: 60, angst: 20, chill: 35, hype: 45, romance: 35, darkness: 15, quirkiness: 20 },
    "country pop":         { melancholy: 25, energy: 55, angst: 10, chill: 40, hype: 50, romance: 55, darkness: 5,  quirkiness: 10 },
    "honky tonk":          { melancholy: 40, energy: 60, angst: 25, chill: 30, hype: 45, romance: 35, darkness: 15, quirkiness: 30 },
    "red dirt":            { melancholy: 40, energy: 55, angst: 30, chill: 35, hype: 35, romance: 30, darkness: 20, quirkiness: 25 },
    "neofolk":             { melancholy: 60, energy: 25, angst: 35, chill: 45, hype: 5,  romance: 25, darkness: 50, quirkiness: 50 },

    // ── Jazz (8+ variants) ───────────────────────────────────────────────
    "jazz":                { melancholy: 40, energy: 45, angst: 15, chill: 55, hype: 20, romance: 45, darkness: 15, quirkiness: 45 },
    "smooth jazz":         { melancholy: 25, energy: 30, angst: 5,  chill: 80, hype: 10, romance: 55, darkness: 5,  quirkiness: 20 },
    "free jazz":           { melancholy: 40, energy: 60, angst: 35, chill: 20, hype: 20, romance: 10, darkness: 30, quirkiness: 90 },
    "jazz fusion":         { melancholy: 30, energy: 60, angst: 15, chill: 35, hype: 30, romance: 25, darkness: 15, quirkiness: 70 },
    "bebop":               { melancholy: 30, energy: 65, angst: 15, chill: 30, hype: 35, romance: 25, darkness: 10, quirkiness: 60 },
    "bossa nova":          { melancholy: 35, energy: 25, angst: 5,  chill: 85, hype: 10, romance: 75, darkness: 5,  quirkiness: 30 },
    "swing":               { melancholy: 15, energy: 70, angst: 5,  chill: 30, hype: 65, romance: 40, darkness: 5,  quirkiness: 30 },
    "acid jazz":           { melancholy: 25, energy: 55, angst: 10, chill: 45, hype: 40, romance: 30, darkness: 10, quirkiness: 50 },
    "cool jazz":           { melancholy: 40, energy: 35, angst: 10, chill: 70, hype: 15, romance: 40, darkness: 15, quirkiness: 40 },
    "big band":            { melancholy: 15, energy: 75, angst: 5,  chill: 20, hype: 65, romance: 35, darkness: 5,  quirkiness: 25 },
    "latin jazz":          { melancholy: 20, energy: 65, angst: 10, chill: 35, hype: 55, romance: 45, darkness: 5,  quirkiness: 35 },
    "nu jazz":             { melancholy: 30, energy: 50, angst: 10, chill: 50, hype: 30, romance: 30, darkness: 15, quirkiness: 55 },

    // ── Classical (6+ variants) ──────────────────────────────────────────
    "classical":           { melancholy: 50, energy: 40, angst: 25, chill: 50, hype: 15, romance: 45, darkness: 25, quirkiness: 25 },
    "opera":               { melancholy: 60, energy: 55, angst: 40, chill: 20, hype: 25, romance: 65, darkness: 35, quirkiness: 30 },
    "baroque":             { melancholy: 35, energy: 45, angst: 15, chill: 45, hype: 15, romance: 30, darkness: 15, quirkiness: 35 },
    "romantic era":        { melancholy: 60, energy: 50, angst: 35, chill: 35, hype: 20, romance: 70, darkness: 30, quirkiness: 25 },
    "contemporary classical": { melancholy: 45, energy: 35, angst: 30, chill: 40, hype: 10, romance: 25, darkness: 35, quirkiness: 60 },
    "minimalism":          { melancholy: 40, energy: 20, angst: 15, chill: 65, hype: 5,  romance: 20, darkness: 20, quirkiness: 55 },
    "orchestral":          { melancholy: 50, energy: 55, angst: 30, chill: 30, hype: 30, romance: 50, darkness: 25, quirkiness: 20 },
    "chamber music":       { melancholy: 45, energy: 30, angst: 15, chill: 55, hype: 10, romance: 40, darkness: 15, quirkiness: 30 },
    "neoclassical":        { melancholy: 50, energy: 35, angst: 25, chill: 50, hype: 10, romance: 40, darkness: 30, quirkiness: 40 },

    // ── Reggae / Ska / Caribbean ─────────────────────────────────────────
    "reggae":              { melancholy: 30, energy: 45, angst: 15, chill: 70, hype: 35, romance: 35, darkness: 10, quirkiness: 25 },
    "ska":                 { melancholy: 10, energy: 80, angst: 15, chill: 20, hype: 70, romance: 15, darkness: 5,  quirkiness: 45 },
    "dub":                 { melancholy: 35, energy: 35, angst: 10, chill: 75, hype: 20, romance: 15, darkness: 25, quirkiness: 50 },
    "reggaeton":           { melancholy: 10, energy: 80, angst: 10, chill: 15, hype: 90, romance: 45, darkness: 10, quirkiness: 15 },
    "dancehall":           { melancholy: 10, energy: 85, angst: 15, chill: 15, hype: 85, romance: 35, darkness: 10, quirkiness: 25 },
    "ska punk":            { melancholy: 10, energy: 85, angst: 30, chill: 10, hype: 75, romance: 10, darkness: 10, quirkiness: 55 },

    // ── African / Latin / World ──────────────────────────────────────────
    "afrobeat":            { melancholy: 15, energy: 75, angst: 10, chill: 30, hype: 70, romance: 30, darkness: 5,  quirkiness: 35 },
    "afrobeats":           { melancholy: 15, energy: 70, angst: 10, chill: 30, hype: 75, romance: 40, darkness: 5,  quirkiness: 25 },
    "latin":               { melancholy: 25, energy: 65, angst: 15, chill: 30, hype: 65, romance: 55, darkness: 10, quirkiness: 20 },
    "salsa":               { melancholy: 20, energy: 80, angst: 10, chill: 15, hype: 75, romance: 55, darkness: 5,  quirkiness: 20 },
    "bachata":             { melancholy: 45, energy: 50, angst: 20, chill: 35, hype: 45, romance: 80, darkness: 15, quirkiness: 10 },
    "cumbia":              { melancholy: 20, energy: 65, angst: 10, chill: 35, hype: 60, romance: 40, darkness: 5,  quirkiness: 25 },
    "samba":               { melancholy: 15, energy: 80, angst: 5,  chill: 20, hype: 75, romance: 35, darkness: 5,  quirkiness: 30 },
    "world music":         { melancholy: 30, energy: 50, angst: 15, chill: 45, hype: 30, romance: 30, darkness: 15, quirkiness: 45 },
    "flamenco":            { melancholy: 55, energy: 65, angst: 45, chill: 20, hype: 40, romance: 60, darkness: 30, quirkiness: 35 },

    // ── Shoegaze / Dream / Ethereal ──────────────────────────────────────
    "shoegaze":            { melancholy: 65, energy: 45, angst: 35, chill: 55, hype: 10, romance: 40, darkness: 35, quirkiness: 60 },
    "slowcore":            { melancholy: 80, energy: 15, angst: 40, chill: 55, hype: 2,  romance: 35, darkness: 45, quirkiness: 40 },
    "ethereal wave":       { melancholy: 55, energy: 25, angst: 15, chill: 65, hype: 5,  romance: 45, darkness: 35, quirkiness: 50 },

    // ── Goth / Dark / Industrial ─────────────────────────────────────────
    "gothic rock":         { melancholy: 70, energy: 55, angst: 55, chill: 15, hype: 20, romance: 40, darkness: 80, quirkiness: 45 },
    "darkwave":            { melancholy: 65, energy: 50, angst: 45, chill: 20, hype: 20, romance: 30, darkness: 80, quirkiness: 45 },
    "ebm":                 { melancholy: 30, energy: 75, angst: 40, chill: 10, hype: 50, romance: 10, darkness: 60, quirkiness: 40 },
    "witch house":         { melancholy: 55, energy: 40, angst: 45, chill: 30, hype: 15, romance: 15, darkness: 85, quirkiness: 70 },
    "deathrock":           { melancholy: 55, energy: 65, angst: 60, chill: 5,  hype: 25, romance: 15, darkness: 85, quirkiness: 55 },
    "coldwave":            { melancholy: 60, energy: 45, angst: 45, chill: 25, hype: 15, romance: 20, darkness: 70, quirkiness: 50 },

    // ── New Wave / Post-Punk Revival ─────────────────────────────────────
    "new wave":            { melancholy: 35, energy: 60, angst: 25, chill: 30, hype: 45, romance: 35, darkness: 20, quirkiness: 55 },
    "post-punk revival":   { melancholy: 45, energy: 65, angst: 45, chill: 20, hype: 40, romance: 25, darkness: 40, quirkiness: 40 },
    "no wave":             { melancholy: 35, energy: 70, angst: 55, chill: 5,  hype: 20, romance: 5,  darkness: 50, quirkiness: 85 },

    // ── Lo-fi / Chiptune / Niche Electronic ──────────────────────────────
    "lo-fi":               { melancholy: 50, energy: 20, angst: 15, chill: 80, hype: 5,  romance: 30, darkness: 15, quirkiness: 40 },
    "chiptune":            { melancholy: 10, energy: 65, angst: 5,  chill: 25, hype: 50, romance: 10, darkness: 5,  quirkiness: 85 },
    "city pop":            { melancholy: 30, energy: 50, angst: 10, chill: 60, hype: 30, romance: 55, darkness: 5,  quirkiness: 45 },
    "trip hop":            { melancholy: 55, energy: 35, angst: 30, chill: 60, hype: 15, romance: 35, darkness: 45, quirkiness: 45 },
    "future garage":       { melancholy: 40, energy: 45, angst: 15, chill: 55, hype: 30, romance: 20, darkness: 25, quirkiness: 50 },
    "glitch":              { melancholy: 25, energy: 50, angst: 20, chill: 30, hype: 25, romance: 5,  darkness: 20, quirkiness: 90 },
    "glitch hop":          { melancholy: 15, energy: 65, angst: 10, chill: 25, hype: 55, romance: 10, darkness: 10, quirkiness: 75 },

    // ── Post-Rock / Experimental ─────────────────────────────────────────
    "post-rock":           { melancholy: 70, energy: 45, angst: 35, chill: 45, hype: 15, romance: 25, darkness: 35, quirkiness: 50 },
    "experimental":        { melancholy: 35, energy: 45, angst: 30, chill: 30, hype: 15, romance: 10, darkness: 35, quirkiness: 90 },
    "noise":               { melancholy: 25, energy: 75, angst: 65, chill: 5,  hype: 20, romance: 2,  darkness: 55, quirkiness: 80 },
    "drone":               { melancholy: 55, energy: 20, angst: 25, chill: 45, hype: 2,  romance: 5,  darkness: 55, quirkiness: 60 },
    "musique concrete":    { melancholy: 30, energy: 30, angst: 25, chill: 25, hype: 5,  romance: 5,  darkness: 35, quirkiness: 95 },
    "avant-garde":         { melancholy: 35, energy: 40, angst: 30, chill: 25, hype: 10, romance: 10, darkness: 35, quirkiness: 95 },

    // ── Twee / Jangle / Indie Niche ──────────────────────────────────────
    "twee pop":            { melancholy: 35, energy: 35, angst: 15, chill: 50, hype: 20, romance: 50, darkness: 5,  quirkiness: 70 },
    "noise pop":           { melancholy: 35, energy: 60, angst: 30, chill: 25, hype: 30, romance: 25, darkness: 20, quirkiness: 65 },
    "jangle pop":          { melancholy: 35, energy: 50, angst: 15, chill: 45, hype: 30, romance: 40, darkness: 10, quirkiness: 45 },
    "c86":                 { melancholy: 40, energy: 45, angst: 20, chill: 40, hype: 20, romance: 40, darkness: 10, quirkiness: 55 },
    "sadcore":             { melancholy: 90, energy: 15, angst: 50, chill: 40, hype: 2,  romance: 30, darkness: 55, quirkiness: 35 },

    // ── New Age / Healing / Meditation ───────────────────────────────────
    "new age":             { melancholy: 25, energy: 10, angst: 5,  chill: 90, hype: 2,  romance: 25, darkness: 10, quirkiness: 30 },
    "meditation":          { melancholy: 20, energy: 5,  angst: 2,  chill: 95, hype: 2,  romance: 15, darkness: 5,  quirkiness: 15 },
    "healing":             { melancholy: 15, energy: 8,  angst: 2,  chill: 92, hype: 2,  romance: 20, darkness: 5,  quirkiness: 15 },

    // ── Disco / Dance ────────────────────────────────────────────────────
    "disco":               { melancholy: 10, energy: 85, angst: 5,  chill: 15, hype: 85, romance: 40, darkness: 5,  quirkiness: 25 },
    "nu-disco":            { melancholy: 15, energy: 75, angst: 5,  chill: 25, hype: 70, romance: 35, darkness: 5,  quirkiness: 35 },
    "italo disco":         { melancholy: 20, energy: 75, angst: 5,  chill: 20, hype: 70, romance: 35, darkness: 10, quirkiness: 45 },

    // ── Singer-Songwriter / Acoustic ─────────────────────────────────────
    "singer-songwriter":   { melancholy: 60, energy: 25, angst: 30, chill: 55, hype: 5,  romance: 55, darkness: 25, quirkiness: 25 },
    "acoustic":            { melancholy: 45, energy: 25, angst: 20, chill: 65, hype: 10, romance: 50, darkness: 10, quirkiness: 15 },

    // ── Misc / Extra Coverage ────────────────────────────────────────────
    "grindcore":           { melancholy: 10, energy: 98, angst: 90, chill: 1,  hype: 50, romance: 1,  darkness: 65, quirkiness: 55 },
    "powerviolence":       { melancholy: 10, energy: 98, angst: 95, chill: 1,  hype: 45, romance: 1,  darkness: 60, quirkiness: 50 },
    "black metal":         { melancholy: 50, energy: 85, angst: 75, chill: 5,  hype: 40, romance: 2,  darkness: 95, quirkiness: 45 },
    "post-metal":          { melancholy: 60, energy: 65, angst: 50, chill: 20, hype: 20, romance: 10, darkness: 60, quirkiness: 45 },
    "blackgaze":           { melancholy: 65, energy: 65, angst: 50, chill: 25, hype: 15, romance: 20, darkness: 65, quirkiness: 55 },
    "stoner metal":        { melancholy: 35, energy: 65, angst: 30, chill: 40, hype: 30, romance: 5,  darkness: 50, quirkiness: 50 },
    "melodic death metal": { melancholy: 45, energy: 90, angst: 55, chill: 5,  hype: 55, romance: 10, darkness: 65, quirkiness: 30 },
    "technical death metal": { melancholy: 20, energy: 95, angst: 55, chill: 2, hype: 50, romance: 2,  darkness: 70, quirkiness: 70 },
    "atmospheric black metal": { melancholy: 65, energy: 65, angst: 50, chill: 25, hype: 15, romance: 10, darkness: 80, quirkiness: 55 },
    "depressive black metal": { melancholy: 90, energy: 55, angst: 80, chill: 10, hype: 5, romance: 5, darkness: 95, quirkiness: 40 },
    "war metal":           { melancholy: 15, energy: 95, angst: 80, chill: 1,  hype: 40, romance: 1,  darkness: 90, quirkiness: 35 },

    "electro swing":       { melancholy: 10, energy: 75, angst: 5,  chill: 25, hype: 70, romance: 30, darkness: 5,  quirkiness: 65 },
    "future funk":         { melancholy: 15, energy: 70, angst: 5,  chill: 30, hype: 65, romance: 30, darkness: 5,  quirkiness: 60 },
    "mallsoft":            { melancholy: 55, energy: 10, angst: 10, chill: 75, hype: 2,  romance: 15, darkness: 15, quirkiness: 85 },
    "dark ambient":        { melancholy: 60, energy: 10, angst: 30, chill: 40, hype: 2,  romance: 5,  darkness: 90, quirkiness: 50 },
    "power electronics":   { melancholy: 20, energy: 70, angst: 75, chill: 2,  hype: 15, romance: 2,  darkness: 85, quirkiness: 65 },
    "harsh noise":         { melancholy: 15, energy: 80, angst: 70, chill: 2,  hype: 10, romance: 1,  darkness: 65, quirkiness: 85 },
    "harsh noise wall":    { melancholy: 20, energy: 60, angst: 55, chill: 5,  hype: 5,  romance: 1,  darkness: 70, quirkiness: 90 },

    "riddim":              { melancholy: 5,  energy: 90, angst: 25, chill: 5,  hype: 90, romance: 5,  darkness: 30, quirkiness: 30 },
    "brostep":             { melancholy: 5,  energy: 92, angst: 30, chill: 3,  hype: 90, romance: 5,  darkness: 25, quirkiness: 30 },
    "complextro":          { melancholy: 10, energy: 85, angst: 15, chill: 5,  hype: 80, romance: 10, darkness: 15, quirkiness: 60 },
    "psytrance":           { melancholy: 15, energy: 90, angst: 10, chill: 10, hype: 80, romance: 10, darkness: 25, quirkiness: 55 },
    "goa trance":          { melancholy: 20, energy: 85, angst: 10, chill: 15, hype: 70, romance: 15, darkness: 20, quirkiness: 50 },

    "oi":                  { melancholy: 10, energy: 85, angst: 75, chill: 5,  hype: 65, romance: 5,  darkness: 30, quirkiness: 25 },
    "folk punk":           { melancholy: 45, energy: 65, angst: 55, chill: 15, hype: 45, romance: 25, darkness: 25, quirkiness: 55 },
    "celtic punk":         { melancholy: 30, energy: 80, angst: 35, chill: 10, hype: 70, romance: 20, darkness: 15, quirkiness: 45 },
    "cowpunk":             { melancholy: 30, energy: 75, angst: 45, chill: 15, hype: 55, romance: 20, darkness: 20, quirkiness: 55 },
    "psychobilly":         { melancholy: 15, energy: 85, angst: 40, chill: 5,  hype: 65, romance: 15, darkness: 40, quirkiness: 65 },
    "rockabilly":          { melancholy: 15, energy: 75, angst: 15, chill: 20, hype: 60, romance: 30, darkness: 10, quirkiness: 40 },

    "mpb":                 { melancholy: 35, energy: 45, angst: 15, chill: 55, hype: 30, romance: 50, darkness: 10, quirkiness: 35 },
    "tropicalia":          { melancholy: 25, energy: 55, angst: 15, chill: 45, hype: 40, romance: 35, darkness: 10, quirkiness: 65 },
    "fado":                { melancholy: 85, energy: 25, angst: 40, chill: 40, hype: 5,  romance: 65, darkness: 45, quirkiness: 20 },
    "tango":               { melancholy: 55, energy: 55, angst: 35, chill: 25, hype: 30, romance: 80, darkness: 30, quirkiness: 25 },
    "bollywood":           { melancholy: 30, energy: 65, angst: 20, chill: 25, hype: 65, romance: 70, darkness: 10, quirkiness: 30 },
    "qawwali":             { melancholy: 40, energy: 60, angst: 20, chill: 30, hype: 40, romance: 35, darkness: 10, quirkiness: 35 },
    "klezmer":             { melancholy: 45, energy: 65, angst: 20, chill: 15, hype: 45, romance: 25, darkness: 15, quirkiness: 65 },
    "polka":               { melancholy: 5,  energy: 75, angst: 2,  chill: 15, hype: 60, romance: 15, darkness: 2,  quirkiness: 55 },
    "celtic":              { melancholy: 40, energy: 45, angst: 15, chill: 50, hype: 25, romance: 35, darkness: 15, quirkiness: 30 },
    "zydeco":              { melancholy: 15, energy: 75, angst: 5,  chill: 20, hype: 65, romance: 25, darkness: 5,  quirkiness: 45 },
    "mariachi":            { melancholy: 35, energy: 70, angst: 20, chill: 15, hype: 55, romance: 55, darkness: 10, quirkiness: 30 },

    "uk drill":            { melancholy: 30, energy: 80, angst: 60, chill: 10, hype: 75, romance: 5,  darkness: 65, quirkiness: 15 },
    "jersey club":         { melancholy: 5,  energy: 85, angst: 5,  chill: 10, hype: 90, romance: 15, darkness: 5,  quirkiness: 35 },
    "footwork":            { melancholy: 10, energy: 90, angst: 10, chill: 5,  hype: 80, romance: 5,  darkness: 10, quirkiness: 55 },
    "juke":                { melancholy: 10, energy: 85, angst: 10, chill: 10, hype: 80, romance: 10, darkness: 10, quirkiness: 45 },
    "bounce":              { melancholy: 5,  energy: 90, angst: 10, chill: 5,  hype: 92, romance: 20, darkness: 10, quirkiness: 30 },
    "baile funk":          { melancholy: 5,  energy: 90, angst: 10, chill: 5,  hype: 90, romance: 20, darkness: 15, quirkiness: 35 },

    "emo pop":             { melancholy: 60, energy: 65, angst: 65, chill: 15, hype: 45, romance: 45, darkness: 30, quirkiness: 20 },
    "midwest emo":         { melancholy: 75, energy: 50, angst: 70, chill: 25, hype: 20, romance: 40, darkness: 35, quirkiness: 45 },
    "twinkle emo":         { melancholy: 70, energy: 45, angst: 60, chill: 30, hype: 15, romance: 35, darkness: 30, quirkiness: 55 },

    "worship":             { melancholy: 20, energy: 45, angst: 5,  chill: 50, hype: 35, romance: 30, darkness: 5,  quirkiness: 5  },
    "ccm":                 { melancholy: 20, energy: 50, angst: 10, chill: 40, hype: 40, romance: 30, darkness: 5,  quirkiness: 5  },

    "ska punk":            { melancholy: 10, energy: 85, angst: 30, chill: 10, hype: 75, romance: 10, darkness: 10, quirkiness: 55 },
    "2 tone":              { melancholy: 20, energy: 70, angst: 25, chill: 20, hype: 55, romance: 15, darkness: 15, quirkiness: 45 },

    "dark electro":        { melancholy: 45, energy: 65, angst: 50, chill: 10, hype: 35, romance: 10, darkness: 80, quirkiness: 45 },
    "futurepop":           { melancholy: 35, energy: 65, angst: 25, chill: 20, hype: 50, romance: 25, darkness: 40, quirkiness: 35 },
    "aggrotech":           { melancholy: 20, energy: 85, angst: 60, chill: 3,  hype: 55, romance: 5,  darkness: 70, quirkiness: 40 },

    "trap metal":          { melancholy: 25, energy: 90, angst: 80, chill: 2,  hype: 80, romance: 5,  darkness: 55, quirkiness: 35 },
    "rage":                { melancholy: 15, energy: 90, angst: 70, chill: 2,  hype: 85, romance: 5,  darkness: 40, quirkiness: 30 },
    "plugg":               { melancholy: 35, energy: 55, angst: 25, chill: 40, hype: 55, romance: 20, darkness: 25, quirkiness: 30 },
    "detroit techno":      { melancholy: 25, energy: 75, angst: 10, chill: 20, hype: 60, romance: 10, darkness: 25, quirkiness: 35 },
    "berlin techno":       { melancholy: 25, energy: 80, angst: 15, chill: 15, hype: 65, romance: 5,  darkness: 40, quirkiness: 30 },
    "dub techno":          { melancholy: 35, energy: 50, angst: 5,  chill: 60, hype: 30, romance: 10, darkness: 25, quirkiness: 40 },
    "microhouse":          { melancholy: 25, energy: 50, angst: 5,  chill: 50, hype: 35, romance: 10, darkness: 15, quirkiness: 55 },
  },


  // ---------------------------------------------------------------------------
  // rarityMap  (150+ entries)
  // 0 = super mainstream, 100 = ultra obscure
  // ---------------------------------------------------------------------------
  rarityMap: {
    // Ultra mainstream (0-15)
    "pop":                 5,
    "hip hop":             8,
    "rap":                 8,
    "rock":                10,
    "r&b":                 10,
    "country":             12,
    "edm":                 12,
    "latin":               12,
    "reggaeton":           15,
    "dance pop":           10,
    "k-pop":               15,

    // Mainstream (15-30)
    "alternative rock":    20,
    "alt rock":            20,
    "classic rock":        15,
    "indie":               22,
    "metal":               20,
    "electronic":          18,
    "punk":                25,
    "jazz":                22,
    "blues":               20,
    "soul":                20,
    "folk":                25,
    "classical":           20,
    "reggae":              22,
    "disco":               18,
    "funk":                22,
    "house":               20,
    "trap":                15,
    "emo":                 25,
    "gospel":              20,
    "teen pop":            10,
    "hard rock":           18,
    "soft rock":           15,
    "j-pop":               20,
    "pop punk":            22,
    "dubstep":             20,
    "trance":              22,
    "techno":              22,
    "synth pop":           25,
    "synthpop":            25,
    "heavy metal":         20,
    "nu metal":            25,
    "new wave":            28,
    "drum and bass":       25,
    "smooth jazz":         20,
    "afrobeats":           18,
    "bachata":             20,
    "bollywood":           18,
    "country pop":         12,

    // Moderate (30-50)
    "indie rock":          35,
    "indie pop":           35,
    "grunge":              30,
    "punk rock":           28,
    "metalcore":           35,
    "southern rock":       30,
    "americana":           35,
    "bluegrass":           35,
    "ska":                 35,
    "prog rock":           38,
    "progressive rock":    38,
    "dream pop":           40,
    "electropop":          30,
    "power pop":           35,
    "neo soul":            35,
    "motown":              25,
    "bossa nova":          35,
    "swing":               30,
    "deep house":          32,
    "ambient":             35,
    "trip hop":            40,
    "post-punk":           40,
    "gothic rock":         42,
    "garage rock":         38,
    "psychedelic rock":    35,
    "art pop":             42,
    "lo-fi":               32,
    "lo-fi hip hop":       30,
    "emo rap":             30,
    "cloud rap":           38,
    "drill":               28,
    "grime":               32,
    "dancehall":           30,
    "salsa":               25,
    "flamenco":            35,
    "opera":               30,
    "singer-songwriter":   28,
    "acoustic":            20,
    "boom bap":            35,
    "gangsta rap":         25,
    "west coast rap":      25,
    "east coast hip hop":  28,
    "southern hip hop":    25,
    "bebop":               40,
    "big band":            30,
    "blues rock":          30,
    "folk rock":           30,
    "orchestral":          28,
    "thrash metal":        35,
    "power metal":         40,
    "baroque":             35,
    "synthwave":           38,
    "retrowave":           40,
    "hardcore":            38,
    "hardcore punk":       40,
    "bedroom pop":         35,
    "dark pop":            35,
    "progressive house":   30,
    "tropical house":      28,
    "hyperpop":            38,
    "phonk":               35,
    "uk garage":           38,
    "afrobeat":            35,
    "cumbia":              30,
    "samba":               30,
    "tango":               35,
    "celtic":              32,
    "mariachi":            30,
    "rockabilly":          35,
    "nu-disco":            38,

    // Niche (50-70)
    "shoegaze":            55,
    "post-rock":           55,
    "stoner rock":         55,
    "doom metal":          58,
    "death metal":         50,
    "black metal":         52,
    "sludge metal":        60,
    "gothic metal":        55,
    "symphonic metal":     50,
    "industrial metal":    50,
    "industrial":          48,
    "prog metal":          52,
    "progressive metal":   52,
    "deathcore":           52,
    "post-hardcore":       45,
    "screamo":             55,
    "darkwave":            58,
    "ebm":                 60,
    "chillwave":           55,
    "vaporwave":           55,
    "idm":                 60,
    "breakbeat":           50,
    "jungle":              52,
    "acid house":          50,
    "acid jazz":           50,
    "jazz fusion":         48,
    "free jazz":           60,
    "cool jazz":           50,
    "latin jazz":          45,
    "downtempo":           50,
    "dub":                 45,
    "noise rock":          60,
    "art rock":            55,
    "space rock":          58,
    "glam rock":           40,
    "surf rock":           50,
    "folk punk":           55,
    "ska punk":            45,
    "psychobilly":         55,
    "fado":                55,
    "klezmer":             60,
    "qawwali":             60,
    "future bass":         40,
    "hardstyle":           42,
    "electro":             40,
    "alt-country":         50,
    "outlaw country":      42,
    "country rock":        35,
    "honky tonk":          40,
    "chamber pop":         55,
    "garage":              45,
    "emo pop":             40,
    "melodic hardcore":    52,
    "slow core":           60,
    "uk drill":            38,
    "celtic punk":         55,
    "conscious hip hop":   40,
    "abstract hip hop":    55,

    // Obscure (70-85)
    "math rock":           72,
    "noise pop":           70,
    "twee pop":            72,
    "jangle pop":          70,
    "slowcore":            72,
    "sadcore":             75,
    "post-punk revival":   55,
    "no wave":             78,
    "stoner metal":        65,
    "groove metal":        55,
    "speed metal":         55,
    "folk metal":          58,
    "djent":               62,
    "melodic death metal": 58,
    "technical death metal": 70,
    "atmospheric black metal": 72,
    "blackgaze":           75,
    "post-metal":          65,
    "crust punk":          72,
    "grindcore":           70,
    "mathcore":            75,
    "emocore":             60,
    "skate punk":          50,
    "midwest emo":         65,
    "twinkle emo":         78,
    "dark electro":        68,
    "futurepop":           70,
    "aggrotech":           75,
    "witch house":         78,
    "coldwave":            72,
    "deathrock":           75,
    "ethereal wave":       68,
    "neofolk":             72,
    "dark ambient":        70,
    "minimal techno":      55,
    "psytrance":           55,
    "goa trance":          60,
    "electronica":         40,
    "electro swing":       55,
    "future funk":         65,
    "glitch":              70,
    "glitch hop":          68,
    "future garage":       70,
    "microhouse":          72,
    "detroit techno":      55,
    "dub techno":          62,
    "complextro":          70,
    "footwork":            68,
    "juke":                72,
    "jersey club":         58,
    "baile funk":          62,
    "city pop":            55,
    "mpb":                 58,
    "tropicalia":          65,
    "italo disco":         60,
    "zydeco":              65,
    "red dirt":            55,
    "cowpunk":             72,
    "polka":               50,
    "chamber music":       45,
    "neoclassical":        55,
    "romantic era":        50,
    "contemporary classical": 55,
    "minimalism":          55,
    "chiptune":            65,
    "trap metal":          58,
    "plugg":               60,
    "bounce":              50,
    "crunk":               35,
    "dirty south":         35,
    "mumble rap":          30,
    "underground hip hop": 45,
    "nu jazz":             62,
    "europop":             30,
    "bubblegum pop":       25,
    "latin pop":           18,
    "sunshine pop":        60,
    "arena rock":          25,
    "yacht rock":          45,
    "worship":             25,
    "ccm":                 25,
    "2 tone":              60,
    "oi":                  70,
    "straight edge":       65,
    "berlin techno":       58,
    "tech house":          35,
    "riddim":              55,
    "brostep":             45,
    "rage":                50,

    // Ultra obscure (85-100)
    "harsh noise":         88,
    "harsh noise wall":    92,
    "power electronics":   88,
    "powerviolence":       85,
    "musique concrete":    90,
    "mallsoft":            88,
    "depressive black metal": 82,
    "war metal":           85,
    "c86":                 82,
    "noise":               75,
    "drone":               78,
    "avant-garde":         75,
    "experimental":        55,
    "meditation":          30,
    "healing":             35,
    "new age":             30,
  },


  // ---------------------------------------------------------------------------
  // emojiMap  (150+ entries)
  // ---------------------------------------------------------------------------
  emojiMap: {
    // Rock
    "rock":                "🎸🔥",
    "classic rock":        "🎸🕶️",
    "indie rock":          "🎸🌿",
    "alternative rock":    "🎸💫",
    "alt rock":            "🎸💫",
    "grunge":              "🎸🌧️",
    "punk rock":           "🎸✊",
    "post-punk":           "🖤🎸",
    "garage rock":         "🏚️🎸",
    "psychedelic rock":    "🍄🌀",
    "prog rock":           "🎹🌌",
    "progressive rock":    "🎹🌌",
    "southern rock":       "🤠🎸",
    "soft rock":           "🎸☁️",
    "hard rock":           "🎸💪",
    "stoner rock":         "🎸🌿",
    "math rock":           "📐🎸",
    "noise rock":          "📢🎸",
    "art rock":            "🎨🎸",
    "surf rock":           "🏄🎸",
    "blues rock":          "🎸🎵",
    "folk rock":           "🍂🎸",
    "space rock":          "🚀🎸",
    "glam rock":           "✨💄",
    "arena rock":          "🏟️🎸",
    "yacht rock":          "⛵🎶",

    // Metal
    "metal":               "🤘⚡",
    "heavy metal":         "🤘🔥",
    "thrash metal":        "🤘💥",
    "death metal":         "💀🤘",
    "black metal":         "🖤⛧",
    "doom metal":          "🕯️🐌",
    "power metal":         "⚔️🐉",
    "metalcore":           "🤘💔",
    "deathcore":           "💀💥",
    "nu metal":            "🤘👽",
    "prog metal":          "🤘🧠",
    "progressive metal":   "🤘🧠",
    "industrial metal":    "⚙️🤘",
    "gothic metal":        "🦇🤘",
    "sludge metal":        "🤘🐊",
    "symphonic metal":     "🎻🤘",
    "speed metal":         "⚡🏎️",
    "groove metal":        "🤘👊",
    "folk metal":          "🍺🤘",
    "djent":               "🎸🔩",
    "melodic death metal": "💀🎶",
    "technical death metal": "💀🧮",
    "atmospheric black metal": "🌑🏔️",
    "depressive black metal": "🖤😞",
    "war metal":           "⚔️💀",
    "post-metal":          "🤘🌊",
    "blackgaze":           "🖤✨",
    "stoner metal":        "🤘🌿",

    // Pop
    "pop":                 "✨💖",
    "synth pop":           "🎹💜",
    "synthpop":            "🎹💜",
    "indie pop":           "🌸🎶",
    "dream pop":           "💭🌸",
    "electropop":          "⚡💖",
    "dance pop":           "💃✨",
    "power pop":           "⚡🎤",
    "art pop":             "🎨💃",
    "hyperpop":            "🌈💊",
    "k-pop":               "🇰🇷💖",
    "j-pop":               "🇯🇵🌸",
    "bedroom pop":         "🛏️🎶",
    "dark pop":            "🖤💅",
    "teen pop":            "💕🎤",
    "chamber pop":         "🎻✨",
    "bubblegum pop":       "🍬💖",
    "europop":             "🇪🇺🎶",
    "latin pop":           "🌺🎤",
    "sunshine pop":        "☀️🎶",

    // Hip-Hop / Rap
    "hip hop":             "🎤🔊",
    "rap":                 "🎤💯",
    "trap":                "🔊💎",
    "boom bap":            "🥁🎤",
    "underground hip hop": "🎤🔦",
    "southern hip hop":    "🎤🤠",
    "west coast rap":      "🌴🎤",
    "east coast hip hop":  "🏙️🎤",
    "gangsta rap":         "🎤🔫",
    "emo rap":             "🖤🎤",
    "cloud rap":           "☁️🎤",
    "lo-fi hip hop":       "🌧️☕",
    "drill":               "🔊🗡️",
    "grime":               "🎤🇬🇧",
    "phonk":               "👻🔊",
    "crunk":               "🥤🔥",
    "conscious hip hop":   "🧠🎤",
    "dirty south":         "🔥🤠",
    "mumble rap":          "🎤💤",
    "abstract hip hop":    "🧩🎤",

    // Electronic
    "electronic":          "🎛️💡",
    "edm":                 "🎉🔊",
    "house":               "🏠🎶",
    "deep house":          "🏠🌊",
    "tech house":          "🏠⚙️",
    "techno":              "🔊🌃",
    "trance":              "🌀✨",
    "dubstep":             "🔊💥",
    "drum and bass":       "🥁⚡",
    "ambient":             "🌌🎧",
    "downtempo":           "🌙🎶",
    "chillwave":           "🌊😌",
    "vaporwave":           "🌴📼",
    "synthwave":           "🌆🎹",
    "retrowave":           "🌆🕹️",
    "future bass":         "🔮🔊",
    "hardstyle":           "💪🔊",
    "breakbeat":           "💔🥁",
    "idm":                 "🧠🎛️",
    "industrial":          "⚙️🏭",
    "jungle":              "🌴🥁",
    "garage":              "🏠🎶",
    "uk garage":           "🇬🇧🏠",
    "electro":             "⚡🎛️",
    "electronica":         "🎛️🎶",
    "minimal techno":      "🔳🔊",
    "acid house":          "😵🏠",
    "progressive house":   "🏠📈",
    "tropical house":      "🌴🏠",

    // Punk / Emo
    "punk":                "✊🔥",
    "pop punk":            "🎸💔",
    "hardcore punk":       "✊💥",
    "hardcore":            "✊💥",
    "emo":                 "🖤💔",
    "screamo":             "😱💔",
    "post-hardcore":       "💔🎸",
    "skate punk":          "🛹🎸",
    "emocore":             "🖤🎸",
    "mathcore":            "📐💥",
    "crust punk":          "✊🐀",
    "melodic hardcore":    "✊🎶",
    "straight edge":       "✊❌",
    "emo pop":             "🖤✨",
    "midwest emo":         "🌾💔",
    "twinkle emo":         "✨💔",

    // R&B / Soul
    "r&b":                 "💜🎤",
    "soul":                "💛🎤",
    "neo soul":            "🌙💜",
    "funk":                "🕺🎵",
    "motown":              "🎵🕺",
    "gospel":              "🙏🎶",
    "blues":               "🎸😢",
    "quiet storm":         "🌙💋",
    "contemporary r&b":    "💜✨",
    "alternative r&b":     "💜🌿",

    // Country / Folk
    "country":             "🤠🎸",
    "bluegrass":           "🪕🌄",
    "americana":           "🇺🇸🍂",
    "outlaw country":      "🤠🔫",
    "folk":                "🍂🎵",
    "indie folk":          "🌿🍂",
    "alt-country":         "🤠🌿",
    "country rock":        "🤠🎸",
    "country pop":         "🤠✨",
    "honky tonk":          "🤠🍺",
    "red dirt":            "🤠🏜️",
    "neofolk":             "🌑🍂",

    // Jazz
    "jazz":                "🎷🌙",
    "smooth jazz":         "🎷🍷",
    "free jazz":           "🎷🌀",
    "jazz fusion":         "🎷⚡",
    "bebop":               "🎷🎩",
    "bossa nova":          "🎷☕",
    "swing":               "🎷💃",
    "acid jazz":           "🎷😵",
    "cool jazz":           "🎷❄️",
    "big band":            "🎺🎷",
    "latin jazz":          "🎷🌺",
    "nu jazz":             "🎷🔮",

    // Classical
    "classical":           "🎻📜",
    "opera":               "🎭🎤",
    "baroque":             "🎻👑",
    "romantic era":        "🎻🌹",
    "contemporary classical": "🎻🔬",
    "minimalism":          "🎹◻️",
    "orchestral":          "🎻🎶",
    "chamber music":       "🎻🕯️",
    "neoclassical":        "🎹🏛️",

    // Reggae / Ska
    "reggae":              "🇯🇲🌿",
    "ska":                 "🎺🏁",
    "dub":                 "🔊🌿",
    "dancehall":           "💃🇯🇲",
    "ska punk":            "🎺✊",
    "2 tone":              "🏁🎺",

    // World / Latin / African
    "afrobeat":            "🥁🌍",
    "afrobeats":           "🌍🔊",
    "latin":               "🌺💃",
    "salsa":               "💃🌶️",
    "bachata":             "💃💕",
    "cumbia":              "💃🪗",
    "samba":               "🇧🇷💃",
    "world music":         "🌍🎶",
    "flamenco":            "💃🔥",
    "fado":                "🇵🇹😢",
    "tango":               "💃🌹",
    "bollywood":           "🇮🇳💃",
    "qawwali":             "🎤🕌",
    "klezmer":             "🎻🕎",
    "polka":               "🪗💃",
    "celtic":              "🍀🎻",
    "zydeco":              "🪗🎶",
    "mariachi":            "🎺🇲🇽",
    "mpb":                 "🇧🇷🎶",
    "tropicalia":          "🌴🎶",
    "baile funk":          "🇧🇷🔊",

    // Shoegaze / Dream / Ethereal
    "shoegaze":            "👟🌫️",
    "slowcore":            "🐌😢",
    "ethereal wave":       "🌫️✨",

    // Goth / Dark
    "gothic rock":         "🦇🖤",
    "darkwave":            "🌑🖤",
    "ebm":                 "⚙️🖤",
    "witch house":         "🏚️🔮",
    "deathrock":           "💀🦇",
    "coldwave":            "❄️🖤",
    "dark electro":        "🖤⚡",
    "futurepop":           "🔮🖤",
    "aggrotech":           "⚙️💢",

    // New Wave
    "new wave":            "🌊🎹",
    "post-punk revival":   "🖤🎸",
    "no wave":             "🚫🌊",

    // Lo-fi / Chiptune / Niche Electronic
    "lo-fi":               "🌧️📻",
    "chiptune":            "🎮🎵",
    "city pop":            "🌃🎤",
    "trip hop":            "🌙🎧",
    "future garage":       "🔮🏠",
    "glitch":              "🔀💻",
    "glitch hop":          "🔀🎤",

    // Post-Rock / Experimental
    "post-rock":           "🌅🎸",
    "experimental":        "🔬🎶",
    "noise":               "📢⚡",
    "drone":               "🔊🧘",
    "musique concrete":    "🔬🔊",
    "avant-garde":         "🎭🔬",

    // Twee / Indie Niche
    "twee pop":            "🌼🎶",
    "noise pop":           "📢🌸",
    "jangle pop":          "🔔🎸",
    "c86":                 "📼🌸",
    "sadcore":             "😢🎶",

    // New Age / Healing
    "new age":             "🔮🌿",
    "meditation":          "🧘✨",
    "healing":             "💆🌿",

    // Disco / Dance
    "disco":               "🪩🕺",
    "nu-disco":            "🪩✨",
    "italo disco":         "🇮🇹🪩",

    // Singer-Songwriter / Acoustic
    "singer-songwriter":   "🎤📝",
    "acoustic":            "🎸🍃",

    // Misc
    "grindcore":           "💥🩸",
    "powerviolence":       "⚡💢",
    "electro swing":       "🎷⚡",
    "future funk":         "🕺🔮",
    "mallsoft":            "🏬📼",
    "dark ambient":        "🌑🎧",
    "power electronics":   "⚡🔊",
    "harsh noise":         "📢😵",
    "harsh noise wall":    "🧱📢",
    "riddim":              "🔊👾",
    "brostep":             "💪🔊",
    "complextro":          "🎛️🧩",
    "psytrance":           "🌀🍄",
    "goa trance":          "🕉️🌀",
    "oi":                  "✊🎵",
    "folk punk":           "🍂✊",
    "celtic punk":         "🍀✊",
    "cowpunk":             "🤠✊",
    "psychobilly":         "💀🤠",
    "rockabilly":          "🎸💈",
    "uk drill":            "🇬🇧🗡️",
    "jersey club":         "🎉💃",
    "footwork":            "👟🔊",
    "juke":                "🎵👟",
    "bounce":              "🍑🔊",
    "trap metal":          "🤘🔊",
    "rage":                "😤🔊",
    "plugg":               "🔌🎤",
    "detroit techno":      "🏙️🔊",
    "berlin techno":       "🇩🇪🔊",
    "dub techno":          "🌀🔊",
    "microhouse":          "🔬🏠",
    "worship":             "🙏✨",
    "ccm":                 "✝️🎶",
  },


  // ---------------------------------------------------------------------------
  // decadeMap  (100+ entries)
  // Genre -> primary decade of origin / peak popularity
  // ---------------------------------------------------------------------------
  decadeMap: {
    // Pre-1960s
    "classical":           "1700s",
    "baroque":             "1600s",
    "romantic era":        "1800s",
    "opera":               "1700s",
    "swing":               "1930s",
    "big band":            "1940s",
    "bebop":               "1940s",
    "blues":               "1920s",
    "gospel":              "1930s",
    "bluegrass":           "1940s",

    // 1950s
    "rock":                "1950s",
    "rockabilly":          "1950s",
    "bossa nova":          "1950s",
    "cool jazz":           "1950s",
    "honky tonk":          "1950s",

    // 1960s
    "soul":                "1960s",
    "motown":              "1960s",
    "folk":                "1960s",
    "folk rock":           "1960s",
    "psychedelic rock":    "1960s",
    "classic rock":        "1960s",
    "r&b":                 "1960s",
    "garage rock":         "1960s",
    "surf rock":           "1960s",
    "free jazz":           "1960s",
    "hard rock":           "1960s",
    "funk":                "1960s",
    "tropicalia":          "1960s",
    "southern rock":       "1960s",
    "country rock":        "1960s",

    // 1970s
    "punk":                "1970s",
    "punk rock":           "1970s",
    "heavy metal":         "1970s",
    "prog rock":           "1970s",
    "progressive rock":    "1970s",
    "disco":               "1970s",
    "reggae":              "1970s",
    "soft rock":           "1970s",
    "country":             "1970s",
    "outlaw country":      "1970s",
    "jazz fusion":         "1970s",
    "glam rock":           "1970s",
    "dub":                 "1970s",
    "blues rock":          "1970s",
    "arena rock":          "1970s",
    "art rock":            "1970s",
    "krautrock":           "1970s",
    "mpb":                 "1970s",
    "ska":                 "1970s",

    // 1980s
    "new wave":            "1980s",
    "synth pop":           "1980s",
    "synthpop":            "1980s",
    "post-punk":           "1980s",
    "gothic rock":         "1980s",
    "thrash metal":        "1980s",
    "hardcore punk":       "1980s",
    "hardcore":            "1980s",
    "hip hop":             "1980s",
    "rap":                 "1980s",
    "house":               "1980s",
    "acid house":          "1980s",
    "techno":              "1980s",
    "industrial":          "1980s",
    "power metal":         "1980s",
    "speed metal":         "1980s",
    "death metal":         "1980s",
    "smooth jazz":         "1980s",
    "quiet storm":         "1980s",
    "darkwave":            "1980s",
    "ebm":                 "1980s",
    "yacht rock":          "1980s",
    "c86":                 "1980s",
    "jangle pop":          "1980s",
    "deathrock":           "1980s",
    "coldwave":            "1980s",
    "italo disco":         "1980s",
    "noise rock":          "1980s",
    "no wave":             "1980s",
    "detroit techno":      "1980s",
    "electropop":          "1980s",
    "twee pop":            "1980s",
    "2 tone":              "1980s",

    // 1990s
    "grunge":              "1990s",
    "alternative rock":    "1990s",
    "alt rock":            "1990s",
    "emo":                 "1990s",
    "shoegaze":            "1990s",
    "trip hop":            "1990s",
    "drum and bass":       "1990s",
    "jungle":              "1990s",
    "trance":              "1990s",
    "black metal":         "1990s",
    "doom metal":          "1990s",
    "nu metal":            "1990s",
    "pop punk":            "1990s",
    "ska punk":            "1990s",
    "gangsta rap":         "1990s",
    "boom bap":            "1990s",
    "east coast hip hop":  "1990s",
    "west coast rap":      "1990s",
    "neo soul":            "1990s",
    "idm":                 "1990s",
    "downtempo":           "1990s",
    "breakbeat":           "1990s",
    "dream pop":           "1990s",
    "slowcore":            "1990s",
    "sadcore":             "1990s",
    "post-rock":           "1990s",
    "stoner rock":         "1990s",
    "sludge metal":        "1990s",
    "acid jazz":           "1990s",
    "uk garage":           "1990s",
    "dancehall":           "1990s",
    "noise pop":           "1990s",
    "math rock":           "1990s",
    "indie rock":          "1990s",
    "indie pop":           "1990s",
    "electronica":         "1990s",
    "psychobilly":         "1990s",
    "celtic punk":         "1990s",
    "space rock":          "1990s",
    "power pop":           "1990s",

    // 2000s
    "emo":                 "2000s",
    "screamo":             "2000s",
    "post-hardcore":       "2000s",
    "metalcore":           "2000s",
    "deathcore":           "2000s",
    "emocore":             "2000s",
    "crunk":               "2000s",
    "southern hip hop":    "2000s",
    "dirty south":         "2000s",
    "grime":               "2000s",
    "deep house":          "2000s",
    "dubstep":             "2000s",
    "electro":             "2000s",
    "mathcore":            "2000s",
    "indie folk":          "2000s",
    "americana":           "2000s",
    "prog metal":          "2000s",
    "progressive metal":   "2000s",
    "groove metal":        "2000s",
    "witch house":         "2000s",
    "dark pop":            "2000s",
    "emo pop":             "2000s",
    "bedroom pop":         "2000s",
    "folkpunk":            "2000s",
    "folk punk":           "2000s",
    "reggaeton":           "2000s",
    "bachata":             "2000s",
    "k-pop":               "2000s",
    "pop":                 "2000s",
    "skate punk":          "2000s",

    // 2010s
    "trap":                "2010s",
    "cloud rap":           "2010s",
    "synthwave":           "2010s",
    "retrowave":           "2010s",
    "vaporwave":           "2010s",
    "chillwave":           "2010s",
    "future bass":         "2010s",
    "edm":                 "2010s",
    "hardstyle":           "2010s",
    "tropical house":      "2010s",
    "progressive house":   "2010s",
    "emo rap":             "2010s",
    "lo-fi hip hop":       "2010s",
    "lo-fi":               "2010s",
    "drill":               "2010s",
    "afrobeats":           "2010s",
    "art pop":             "2010s",
    "dark electro":        "2010s",
    "futurepop":           "2010s",
    "djent":               "2010s",
    "blackgaze":           "2010s",
    "post-metal":          "2010s",
    "nu-disco":            "2010s",
    "electro swing":       "2010s",
    "future funk":         "2010s",
    "chiptune":            "2010s",
    "future garage":       "2010s",
    "complextro":          "2010s",
    "riddim":              "2010s",
    "brostep":             "2010s",
    "tech house":          "2010s",
    "alt-country":         "2010s",
    "midwest emo":         "2010s",
    "twinkle emo":         "2010s",
    "city pop":            "1980s",
    "phonk":               "2010s",
    "mumble rap":          "2010s",
    "footwork":            "2010s",
    "jersey club":         "2010s",
    "baile funk":          "2010s",
    "bounce":              "2010s",

    // 2020s
    "hyperpop":            "2020s",
    "uk drill":            "2020s",
    "plugg":               "2020s",
    "rage":                "2020s",
    "trap metal":          "2020s",

    // Timeless / broad
    "jazz":                "1920s",
    "electronic":          "1990s",
    "metal":               "1980s",
    "latin":               "1950s",
    "world music":         "1980s",
    "afrobeat":            "1970s",
    "flamenco":            "1800s",
    "fado":                "1800s",
    "tango":               "1910s",
    "salsa":               "1960s",
    "cumbia":              "1940s",
    "samba":               "1930s",
    "klezmer":             "1900s",
    "polka":               "1800s",
    "celtic":              "1700s",
    "mariachi":            "1930s",
    "zydeco":              "1950s",
    "qawwali":             "1200s",
    "bollywood":           "1960s",
    "new age":             "1980s",
    "acoustic":            "2000s",
    "singer-songwriter":   "1970s",
    "chamber music":       "1700s",
    "neoclassical":        "2000s",
    "contemporary classical": "1950s",
    "minimalism":          "1960s",
    "orchestral":          "1800s",
    "industrial metal":    "1990s",
    "gothic metal":        "1990s",
    "symphonic metal":     "1990s",
    "melodic death metal": "1990s",
    "technical death metal": "1990s",
    "atmospheric black metal": "2000s",
    "depressive black metal": "2000s",
    "folk metal":          "2000s",
    "dark ambient":        "1990s",
    "mallsoft":            "2010s",
    "noise":               "1970s",
    "drone":               "1990s",
    "experimental":        "1960s",
    "avant-garde":         "1950s",
    "musique concrete":    "1940s",
    "abstract hip hop":    "2000s",
    "conscious hip hop":   "1990s",
    "underground hip hop": "1990s",
    "ethereal wave":       "1980s",
    "neofolk":             "1990s",
    "aggrotech":           "2000s",
    "psytrance":           "1990s",
    "goa trance":          "1990s",
    "minimal techno":      "1990s",
    "berlin techno":       "1990s",
    "dub techno":          "1990s",
    "microhouse":          "2000s",
    "glitch":              "1990s",
    "glitch hop":          "2010s",
    "juke":                "2000s",
    "post-punk revival":   "2000s",
    "melodic hardcore":    "2000s",
    "crust punk":          "1980s",
    "straight edge":       "1980s",
    "oi":                  "1970s",
    "cowpunk":             "1980s",
    "grindcore":           "1980s",
    "powerviolence":       "1990s",
    "harsh noise":         "1980s",
    "harsh noise wall":    "2000s",
    "power electronics":   "1980s",
    "war metal":           "1990s",
    "worship":             "2000s",
    "ccm":                 "1990s",
    "contemporary r&b":    "2000s",
    "alternative r&b":     "2010s",
    "nu jazz":             "2000s",
    "red dirt":            "2000s",
    "country pop":         "2010s",
    "latin pop":           "2000s",
    "europop":             "1990s",
    "bubblegum pop":       "1960s",
    "sunshine pop":        "1960s",
    "j-pop":               "1990s",
    "teen pop":            "1990s",
    "dance pop":           "2000s",
    "stoner metal":        "1990s",
    "chamber pop":         "2000s",
  },
};


// =============================================================================
// Fuzzy-matching helper functions
// =============================================================================

/**
 * Look up mood scores for a genre string, with fuzzy matching fallback.
 * @param {string} genre
 * @returns {{ melancholy:number, energy:number, angst:number, chill:number, hype:number, romance:number, darkness:number, quirkiness:number }}
 */
window.getGenreMood = function(genre) {
  genre = genre.toLowerCase().trim();

  // Try exact match first
  if (window.GENRE_DATA.moodMap[genre]) {
    return window.GENRE_DATA.moodMap[genre];
  }

  // Try substring matching - find the longest matching key
  var bestMatch = null;
  var bestLen = 0;
  var keys = Object.keys(window.GENRE_DATA.moodMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if ((genre.includes(key) || key.includes(genre)) && key.length > bestLen) {
      bestMatch = window.GENRE_DATA.moodMap[key];
      bestLen = key.length;
    }
  }
  if (bestMatch) return bestMatch;

  // Default neutral scores
  return {
    melancholy: 50,
    energy: 50,
    angst: 50,
    chill: 50,
    hype: 50,
    romance: 50,
    darkness: 50,
    quirkiness: 50
  };
};


/**
 * Look up rarity/obscurity score for a genre string, with fuzzy matching fallback.
 * @param {string} genre
 * @returns {number} 0-100 obscurity score
 */
window.getGenreRarity = function(genre) {
  genre = genre.toLowerCase().trim();

  // Try exact match first
  if (window.GENRE_DATA.rarityMap[genre] !== undefined) {
    return window.GENRE_DATA.rarityMap[genre];
  }

  // Try substring matching - find the longest matching key
  var bestKey = null;
  var bestLen = 0;
  var keys = Object.keys(window.GENRE_DATA.rarityMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if ((genre.includes(key) || key.includes(genre)) && key.length > bestLen) {
      bestKey = key;
      bestLen = key.length;
    }
  }
  if (bestKey) return window.GENRE_DATA.rarityMap[bestKey];

  // Default mid-range obscurity
  return 50;
};


/**
 * Look up emoji string for a genre, with fuzzy matching fallback.
 * @param {string} genre
 * @returns {string}
 */
window.getGenreEmoji = function(genre) {
  genre = genre.toLowerCase().trim();

  if (window.GENRE_DATA.emojiMap[genre]) {
    return window.GENRE_DATA.emojiMap[genre];
  }

  var bestVal = null;
  var bestLen = 0;
  var keys = Object.keys(window.GENRE_DATA.emojiMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if ((genre.includes(key) || key.includes(genre)) && key.length > bestLen) {
      bestVal = window.GENRE_DATA.emojiMap[key];
      bestLen = key.length;
    }
  }
  if (bestVal) return bestVal;

  return "🎵";
};


/**
 * Look up decade string for a genre, with fuzzy matching fallback.
 * @param {string} genre
 * @returns {string}
 */
window.getGenreDecade = function(genre) {
  genre = genre.toLowerCase().trim();

  if (window.GENRE_DATA.decadeMap[genre]) {
    return window.GENRE_DATA.decadeMap[genre];
  }

  var bestVal = null;
  var bestLen = 0;
  var keys = Object.keys(window.GENRE_DATA.decadeMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if ((genre.includes(key) || key.includes(genre)) && key.length > bestLen) {
      bestVal = window.GENRE_DATA.decadeMap[key];
      bestLen = key.length;
    }
  }
  if (bestVal) return bestVal;

  return "unknown";
};

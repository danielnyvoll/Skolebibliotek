# Setup – Skolebibliotek

## Database Setup

1. **Supabase Console**: Log inn på din Supabase-prosjekt
2. **SQL Editor**: Gå til SQL Editor
3. **Kjør SQL**: Kopier all innhold fra `DATABASE_SETUP.sql` og kjør det i SQL Editor
4. Dette oppretter alle nødvendige tabeller

## Environment Variables

Opprett en `.env.local` fil i prosjektroten:

```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```

- Finn din `DATABASE_URL` i Supabase: Innstillinger → Database → Connection string → URI

## Start Development

```bash
npm install
npm run dev
```

Åpne `http://localhost:5173`

## Testing Manual

1. Åpne **Planlegger** (`/planner`)
2. Klikk "Opprett første klasse" og lag en klasse (f.eks. "1A", Trinn 1)
3. Velg klassen fra dropdown
4. Skriv inn pensum (fritekst) og lagre
5. Skriv inn ukeplan (markdown ok) og lagre
6. Legg til en hendelse (f.eks. Elevsamtale, 2025-04-01)
7. Gå til **Dokumentbank** (`/bank`)
8. Opprett et nytt dokument:
   - Tittel: "Leseoppsummering – Eventyr"
   - Kategori: "norsk-1"
   - Trinn: 1
   - Tags: "eventyr, lesing"
   - Tekst: (lim inn noe eksempeltekst)
9. Lagre og se dokumentet i listen

## Troubleshooting

**"DATABASE_URL is missing"**
- Sjekk at `.env.local` eksisterer og har riktig verdi

**"Tabell finnes ikke"**
- Kjør `DATABASE_SETUP.sql` på nytt i Supabase SQL Editor

**Styling ser merkelig ut**
- Sjekk at `app.css` er importert i `src/routes/+layout.svelte` (det burde den være)

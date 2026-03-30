# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Skolebibliotek** is a school library management application built with **SvelteKit 5** and **PostgreSQL**. It provides features for planning (Planlegger) and document management (Dokumentbank), along with a curriculum notes system.

## Tech Stack

- **Frontend**: Svelte 5 (runes-based) with SvelteKit
- **Language**: TypeScript
- **Backend**: SvelteKit server routes + PostgreSQL
- **Database**: PostgreSQL (Supabase)
- **Build**: Vite
- **Formatting**: Prettier (with Svelte plugin)
- **Database Client**: postgres (npm package)

## Development Commands

### Local Development
```sh
npm install              # Install dependencies
npm run dev             # Start development server (port 5173)
npm run dev -- --open   # Start dev server and open in browser
```

### Building & Deployment
```sh
npm run build           # Build for production
npm run preview         # Preview production build locally
```

### Code Quality
```sh
npm run lint            # Check formatting with Prettier
npm run format          # Format all files with Prettier
npm run check           # Type-check with svelte-check
npm run check:watch     # Watch mode for type checking
npm run prepare         # Sync SvelteKit (run on dependency updates)
```

## Project Structure

### Core Architecture

**Database Layer** (`src/lib/server/db.ts`)
- Singleton postgres client connecting to Supabase via `DATABASE_URL` env variable
- Configured for connection pooling (max 5 connections, SSL required)
- Uses `prepare: false` for Supabase transaction pooler compatibility

**API Endpoints** (`src/routes/api/`)
- `/api/weekly` - GET/POST curriculum notes and weekly plans by class & week
  - GET: Fetch notes and plan_md for a specific class and week_start date
  - POST: Upsert curriculum_notes and weekly_plans with conflict handling
- `/api/calendar` - (empty, needs implementation)
- `/api/class` - (empty, needs implementation)

**Pages** (`src/routes/`)
- Root layout (`+layout.svelte`) - Navigation bar with links to Planlegger, Dokumentbank, Hjelp
- Home (`+page.svelte`) - Welcome page
- Planner (`planner/+page.svelte`) - Planning interface
- Document Bank (`bank/+page.svelte`) - Document management interface

### Database Schema

Based on current API usage, the database includes:
- `curriculum_notes` table (class_id, week_start, notes)
- `weekly_plans` table (class_id, week_start, plan_md, updated_at)

## Configuration Details

**Svelte Runes**: Enabled by default (except in node_modules). Modern reactive system - use `$state()`, `$derived()`, `$effect()` instead of reactive declarations.

**Prettier Config**:
- Tabs, single quotes, trailing commas disabled
- 100 character line width
- Svelte plugin enabled for `.svelte` files

**Environment Variables**:
- `DATABASE_URL` - Required PostgreSQL connection string (Supabase)

## Notes

- SvelteKit automatically syncs types when dependencies update; run `npm run prepare` if you see type issues
- The project uses `adapter-auto` for deployment - adjust the adapter in `svelte.config.js` if deploying to a specific environment (Vercel, Netlify, etc.)
- Ensure environment variables are set before running the dev server

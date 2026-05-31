# ⚽ World Cup Trip Planner — USA 2026

A personal trip planner for the World Cup, 14 June – 19 July 2026.

## Setup

### 1. Supabase — create your tables

Go to your [Supabase SQL editor](https://ayjhdtwamaposrfqmrxc.supabase.co) and run the contents of `sql/schema.sql`.

### 2. Deploy to Vercel

1. Push this repo to GitHub
2. Connect the repo in [Vercel](https://vercel.com)
3. No build step needed — it's a static site
4. Vercel will auto-deploy on every push

### 3. Set your email for login

Go to your Supabase dashboard → **Authentication → URL Configuration** and add your Vercel domain (e.g. `https://trip-planner.vercel.app`) as a **Site URL** and **Redirect URL**.

---

## Features

- 📅 Day-by-day calendar view (36 days)
- 👆 Swipe left/right between days (or use arrow buttons)
- ✈️ Travel entries (flight, train, car, bus)
- ⚽ Game entries (teams, venue, kick-off, ticket ref)
- 🎯 Activity entries (location, description, link)
- 🏨 Accommodation entries (location, check-in/out)
- 📝 Notes
- 📋 Shortlist with name, location & link
- Assign shortlist items to a day → becomes an Activity

## Tech

- Plain HTML / CSS / JavaScript (no build step)
- [Supabase](https://supabase.com) for auth + database
- Deployed on [Vercel](https://vercel.com)

# Planner-Tasks

Kanban colaborativo (estilo Trello) com quadros compartilhados por times.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, Prisma + PostgreSQL. Deploy: Railway/Render.

## Desenvolvimento

```bash
cp .env.example .env
docker compose up -d        # Postgres local
npx prisma migrate dev      # aplica o schema
npm run dev
```

## Modelo de dados

User, Board, BoardMember (OWNER/ADMIN/MEMBER), Column, Card, Label, Comment.
Posição de colunas/cartões é um `Float` (reordenar sem reescrever a lista).

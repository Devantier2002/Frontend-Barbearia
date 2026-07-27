# Agenda da barbearia

Agenda simples para o barbeiro organizar os horarios do dia, marcar atendimentos como feitos e acompanhar um dashboard mensal.

## Estrutura

- `src/` = frontend React + Vite.
- `backend/` = API em TypeScript com Express e Prisma.
- Neon = banco PostgreSQL usado pelo backend.

## Como rodar

1. Crie um banco no Neon e copie a `DATABASE_URL`.
2. Entre na pasta `backend/` e crie um `.env` com:

```bash
DATABASE_URL=postgresql://...
PORT=3001
PGSSL=true
```

3. Instale as dependencias da raiz e do backend:

```bash
npm install
npm install --prefix backend
```

4. Gere o Prisma Client e aplique o schema no Neon:

```bash
npm run prisma:generate --prefix backend
npm run prisma:push --prefix backend
```

Se o banco ainda nao tiver as tabelas, o backend tambem tenta fazer esse push sozinho na primeira execucao.

5. Rode frontend e backend juntos:

```bash
npm run dev
```

## Rotas da API

- `GET /api/health`
- `GET /api/appointments?month=YYYY-MM`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`
- `DELETE /api/appointments/:id`

## Acesso local

- Usuario: `barbeiro`
- Senha: `1234`

## Observacao

A senha local e apenas uma barreira simples para o app. Se quiser autenticacao real, o proximo passo e adicionar login no backend.

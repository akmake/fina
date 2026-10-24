# fina

Project repository: **fina**.

## Project files

- `client` — frontend.
- `server` — backend.
- `android` — Android app.
- `docs` — documentation.

## Commands

- `npm run install-all`: `npm install --prefix client && npm install --prefix server`
- `npm run dev`: `concurrently -n client,server -c 'bgBlue.bold,bgMagenta.bold' "npm run dev --prefix client" "npm run dev --prefix server"`
- `npm run build`: `npm run build --prefix client`
- `npm run start`: `npm run start --prefix server`
- `npm run docker:up`: `docker-compose up -d --build`
- `npm run docker:down`: `docker-compose down`

## Existing documentation

מערכת לניהול פיננסית שמתחברת גם לחשבונות הבנק והכרטיס אשראי

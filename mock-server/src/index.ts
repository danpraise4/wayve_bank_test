import { createBankApp } from './createApp';

const port = Number(process.env.PORT ?? 4010);
const { server } = createBankApp();

server.listen(port, () => {
  process.stdout.write(`Wayve mock API listening on http://localhost:${port}\n`);
});

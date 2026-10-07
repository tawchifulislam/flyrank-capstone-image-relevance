import { env } from "./config/env.js";
import { app } from "./http/app.js";

app.listen(env.PORT, () => {
  console.log(`listening on ${env.PORT}`);
});

import { bench, run, summary } from "mitata";

import { main as BigHorn } from "./bighorn";
import { main as Discord } from "./discord";
import { main as Eris }    from "./eris";
import { main as Oceanic } from "./oceanic";

summary( async () => {
  bench(
    "BigHorn (Client)",
    async () => {
      await BigHorn();
    }
  )
  bench(
    "Oceanic (Client)",
    async () => {
      await Oceanic();
    }
  )
  bench(
    "Eris (Client)",
    async () => {
      await Eris();
    }
  )
  bench(
    "Discord (Client)",
    async () => {
      await Discord();
    }
  )
} )

await run();

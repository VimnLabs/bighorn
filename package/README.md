# BigHorn

**Minimalistic, type-safe and high-performance Discord API wrapper for Bun.**

`BigHorn` is a lightweight yet powerful wrapper for the [Discord API](https://discord.com/developers/docs/intro), purpose-built for the [Bun runtime](https://bun.sh/). It offers direct control over WebSocket and REST interactions, with a clean and extensible architecture optimized for developers who need full flexibility without unnecessary abstraction.

---

---

## ✨ Features

- ⚡ Ultra-lightweight with zero external dependencies
- 🔍 Full type-safety using [discord-api-types](https://www.npmjs.com/package/discord-api-types)
- 🧩 Modular entity system with hydration and REST integration
- 🔄 Native WebSocket manager with custom event handling
- 🧠 Built-in logging, caching, and extensibility
- 🔧 Designed specifically for the [Bun](https://bun.sh/) runtime

---

## 📦 Installation

```sh
bun add bighorn
```

---

## 🚀 Quick Start

```ts
import { Message, Client, log } from "bighorn";
import {
  GatewayDispatchEvents,
  GatewayIntentBits
} from "discord-api-types/v10";

export const client = new Client({
  token: Bun.env['TOKEN']!,
  intents:
    GatewayIntentBits.Guilds |
    GatewayIntentBits.GuildMessages |
    GatewayIntentBits.DirectMessages
});

client.listen(GatewayDispatchEvents.Ready, async () => {
  const me = await client.me();
  log.echo("Client", `Logged in as: ${me.raw.username}`);
});

client.listen(GatewayDispatchEvents.MessageCreate, async (data) => {
  const message = new Message(client.rest, data);
  if (message.author.raw.bot) return;

  await message.reply({
    content: "I'm alive!"
  });
});

await client.connect();
```

---

## 📌 Requirements

- [Bun](https://bun.sh/) runtime

---

## 📚 Documentation

Full documentation available soon. For now, check examples and type declarations in the source code.

---

## 🧪 Why bighorn?

Unlike `discord.js`, `Eris`, or `Oceanic.js`, **bighorn** offers:
- Full control of HTTP and WebSocket layers
- Entity-based design with lazy hydration
- First-class TypeScript support with strict types
- Zero abstraction unless absolutely necessary

Ideal for developers who want full control and performance.

### 📈 Benchmark
![Benchmark of BigHorn](https://media.discordapp.net/attachments/1112099372201676802/1384318343762149396/image.png?ex=6851fe6c&is=6850acec&hm=7c9e6c26ed4f0116efc58d05c8fc4b37b74744a8d6d9da60fb0e8f4cf73b31fd&=&format=png&quality=lossless)

---

## 🪪 License

[MIT](./LICENSE)
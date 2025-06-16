import { Message } from "@src/classes/entities/message";
import { Client }  from "@src/core/client";
import { log }     from "@src/logger";
import {
  GatewayDispatchEvents,
  GatewayIntentBits
}                  from "discord-api-types/v10";

export const client = new Client( {
  token : Bun.env['TOKEN']!,
  intents : GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages |
    GatewayIntentBits.MessageContent | GatewayIntentBits.DirectMessages
} );

client.listen( GatewayDispatchEvents.Ready, async () => {
  const me = await client.me()
  log.echo( "Client", `Logged as: ${ me.raw.username }` )
} )
client.listen( GatewayDispatchEvents.MessageCreate, async (data) => {
  const message = new Message( client.rest, data );
  if ( message.author.raw.bot ) return;
  await message.reply( {
    content : "Im alive!"
  } )
} )


await client.connect();



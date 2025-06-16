import { RequestMethod } from "@discordjs/rest";
import { Routes }        from "discord-api-types/v10";
import { Client }        from "discord.js";
import process           from "node:process";

export async function main() {
  const client = new Client( {
    intents : 0
  } )
  
  client.on( "ready", async () => {
    const promises = []
    
    for ( let i = 0 ; i < 10 ; i++ ) {
      promises.push(
        client.rest.request( {
          method : RequestMethod.Get,
          fullRoute : Routes.user( "@me" )
        } )
      );
    }
    
    for ( let i = 0 ; i < 10 ; i++ ) {
      promises.push(
        client.rest.request( {
          method : RequestMethod.Get,
          fullRoute : Routes.user( "1125490330679115847" )
        } )
      );
    }
    
    await Promise.all( promises ).then( async () => {
      await client.destroy();
      process.exit()
    } );
  } )
  
  client.login( Bun.env['TOKEN']! )
}
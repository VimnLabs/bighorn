import { Client }                from "@src/core/client";
import { Method }                from "@src/core/rest"
import { GatewayDispatchEvents } from "discord-api-types/v10";

//import process                   from "node:process";

export function main(requests = 10) {
  const client = new Client( {
    token : Bun.env['TOKEN']!,
    intents : 0,
    maxRetries : 0
  } );
  
  client.listen( GatewayDispatchEvents.Ready, async () => {
    const promises = []
    
    for ( let i = 0 ; i < requests ; i++ ) {
      promises.push(
        client.rest.request( {
          method : Method.GET,
          route : "user",
          args : [ "@me" ]
        } )
      );
    }
    
    for ( let i = 0 ; i < requests ; i++ ) {
      promises.push(
        client.rest.request( {
          method : Method.GET,
          route : "user",
          args : [ "1125490330679115847" ]
        } )
      );
    }
    
    await Promise.all( promises ).then( () => {
      client.destroy();
    } );
  } )
  
  client.connect()
}
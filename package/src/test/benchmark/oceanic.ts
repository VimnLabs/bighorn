import { Routes } from "discord-api-types/v10";
import process    from "node:process";
import { Client } from "oceanic.js";

export async function main(requests = 10) {
  const client = new Client( {
    auth : `Bot ${ Bun.env['TOKEN'] }`
  } );
  
  client.on( "ready", async () => {
    const promises = []
    
    for ( let i = 0 ; i < requests ; i++ ) {
      promises.push(
        client.rest.request( {
          method : "GET",
          path : Routes.user( "@me" ),
          auth : true
        } )
      );
    }
    
    for ( let i = 0 ; i < requests ; i++ ) {
      promises.push(
        client.rest.request( {
          method : "GET",
          path : Routes.user( "1125490330679115847" ),
          auth : true
        } )
      );
    }
    
    await Promise.all( promises ).then( async () => {
      process.exit()
    } );
  } )
  
  client.connect();
}
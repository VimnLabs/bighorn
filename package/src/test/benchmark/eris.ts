import Eris    from "eris";
import process from "node:process";

export async function main(requests = 10) {
  // Replace TOKEN with your bot account's token
  const bot = Eris( `Bot ${ Bun.env["TOKEN"]! }`, {
    intents : []
  } );
  
  bot.on( "ready", async () => {
    const promises = []
    
    for ( let i = 0 ; i < requests ; i++ ) {
      promises.push(
        bot.getRESTUser( "@me" )
      );
    }
    for ( let i = 0 ; i < requests ; i++ ) {
      promises.push(
        bot.getRESTUser( "@me" )
      );
    }
    
    await Promise.all( promises ).then( async () => {
      process.exit()
    } );
  } );
  
  bot.connect();
}